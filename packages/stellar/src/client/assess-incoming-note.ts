import { privKeyScalarDecimalFromRecipientScalarHex } from '../transact/encoding/priv-key-scalar-from-recipient-hex.js';

const COMMITMENT_HEX_LENGTH = 64;

export type IncomingNoteDeadReason = 'commitment_mismatch' | 'nullifier_consumed';

export type IncomingNoteAssessment =
  | { kind: 'dead'; reason: IncomingNoteDeadReason }
  | { kind: 'pending' }
  | { kind: 'spendable' };

export type IncomingNoteFields = {
  value: string;
  nullifier: string;
  secret: string;
  commitment: string;
  asset_hi: string;
  asset_lo: string;
  application_id?: string;
};

export type AssessIncomingNoteInput = {
  note: IncomingNoteFields;
  commitmentHex: string;
  privKeyScalarHex: string;
};

export type AssessIncomingNotePorts = {
  recomputeCommitmentHex: (input: AssessIncomingNoteInput) => Promise<string>;
  hasCommitmentLeaf: (commitmentDecimal: string) => Promise<boolean>;
  calculateNullifierHash: (
    nullifier: string,
    privKeyScalarDecimal: string,
  ) => Promise<string>;
  isNullifierConsumed: (nullifierHashHex: string) => Promise<boolean>;
};

function normalizeCommitmentHex(value: string): string {
  return value
    .trim()
    .replace(/^0x/iu, '')
    .toLowerCase()
    .padStart(COMMITMENT_HEX_LENGTH, '0');
}

function commitmentDecimalFromHex(hex: string): string {
  return BigInt(`0x${normalizeCommitmentHex(hex)}`).toString();
}

function commitmentFieldsAgree(input: {
  noteCommitmentDecimal: string;
  deliveredCommitmentHex: string;
  recomputedCommitmentHex: string;
}): boolean {
  const recomputedHex = normalizeCommitmentHex(input.recomputedCommitmentHex);
  if (recomputedHex !== normalizeCommitmentHex(input.deliveredCommitmentHex)) {
    return false;
  }
  try {
    return BigInt(input.noteCommitmentDecimal.trim()) === BigInt(`0x${recomputedHex}`);
  } catch {
    return false;
  }
}

export async function assessIncomingNote(input: {
  note: IncomingNoteFields;
  commitmentHex: string;
  privKeyScalarHex: string;
  ports: AssessIncomingNotePorts;
}): Promise<IncomingNoteAssessment> {
  const assessmentInput: AssessIncomingNoteInput = {
    note: input.note,
    commitmentHex: input.commitmentHex,
    privKeyScalarHex: input.privKeyScalarHex,
  };
  const recomputedHex = await input.ports.recomputeCommitmentHex(assessmentInput);
  if (
    !commitmentFieldsAgree({
      noteCommitmentDecimal: input.note.commitment,
      deliveredCommitmentHex: input.commitmentHex,
      recomputedCommitmentHex: recomputedHex,
    })
  ) {
    return { kind: 'dead', reason: 'commitment_mismatch' };
  }
  const commitmentDecimal = commitmentDecimalFromHex(recomputedHex);
  const leafPresent = await input.ports.hasCommitmentLeaf(commitmentDecimal);
  if (!leafPresent) {
    return { kind: 'pending' };
  }
  const nullifierHashHex = await input.ports.calculateNullifierHash(
    input.note.nullifier,
    privKeyScalarDecimalFromRecipientScalarHex(input.privKeyScalarHex),
  );
  const consumed = await input.ports.isNullifierConsumed(nullifierHashHex);
  if (consumed) {
    return { kind: 'dead', reason: 'nullifier_consumed' };
  }
  return { kind: 'spendable' };
}
