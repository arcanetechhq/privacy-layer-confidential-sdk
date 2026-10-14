import type { StellarPrivateRecord } from '../../types.js';
import { PublicWithdrawNoteError } from './note-error.js';

export function publicWithdrawNoteAmount(
  record: StellarPrivateRecord,
): bigint | undefined {
  const value = record.coinNote?.value?.trim();
  if (!value) {
    return undefined;
  }
  return BigInt(value);
}

function selectMatchedPublicWithdrawNote(
  matches: StellarPrivateRecord[],
  noteId: string | undefined,
): StellarPrivateRecord | undefined {
  if (noteId !== undefined) {
    return matches.find((record) => record.id === noteId);
  }
  if (matches.length === 1) {
    return matches[0];
  }
  return undefined;
}

function hasPublicWithdrawOpening(
  note: NonNullable<StellarPrivateRecord['coinNote']>,
): boolean {
  return [
    note.value,
    note.secret,
    note.nullifier,
    note.commitment,
    note.asset_hi,
    note.asset_lo,
  ].every((field) => Boolean(field?.trim()));
}

export function isPublicWithdrawNote(record: StellarPrivateRecord): boolean {
  const note = record.coinNote;
  const privateAddress = record.privateAddress?.trim();
  if (record.consumed || record.status === 'spent' || !privateAddress || !note) {
    return false;
  }
  return hasPublicWithdrawOpening(note);
}

export function selectPublicWithdrawNote(input: {
  records: readonly StellarPrivateRecord[];
  asset: string;
  amount: bigint;
  noteId?: string;
}): StellarPrivateRecord {
  const matches = input.records.filter(
    (record) =>
      isPublicWithdrawNote(record) &&
      record.asset === input.asset &&
      publicWithdrawNoteAmount(record) === input.amount,
  );
  const selected = selectMatchedPublicWithdrawNote(matches, input.noteId);
  if (!selected) {
    throw new PublicWithdrawNoteError({
      asset: input.asset,
      amount: input.amount,
      ...(input.noteId === undefined ? {} : { noteId: input.noteId }),
    });
  }
  return selected;
}
