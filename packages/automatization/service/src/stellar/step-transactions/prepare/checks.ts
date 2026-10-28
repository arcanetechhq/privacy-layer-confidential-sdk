import type { PinnedNote } from '@arcanetech/privacy-sdk-automatization-plan';
import { ed25519PubkeyPayloadHexToWithdrawFrDecimals } from '@arcanetech/stellar-privacy-pool-zk-sdk';
import { StrKey } from '@stellar/stellar-sdk';
import {
  FR_ORDER,
  hexToDecimal,
  stripHexPrefix,
  type FieldPair,
} from '../../shared/index.js';

function noteTotal(notes: readonly PinnedNote[]): bigint {
  return notes.reduce((total, note) => total + note.plaintext.amount, 0n);
}

export function assertBalance(input: {
  readonly publicDeposit: bigint;
  readonly publicWithdrawal: bigint;
  readonly feeAmount: bigint;
  readonly unspentAmount: bigint;
  readonly inputs: readonly PinnedNote[];
  readonly outputs: readonly PinnedNote[];
}): void {
  const incoming = input.publicDeposit + noteTotal(input.inputs);
  const outgoing =
    input.publicWithdrawal +
    input.feeAmount +
    input.unspentAmount +
    noteTotal(input.outputs);
  if (incoming !== outgoing) {
    throw new Error('Step value does not balance');
  }
}

function signalFields(publicHex: string): bigint[] {
  const bytes = Buffer.from(stripHexPrefix(publicHex), 'hex');
  const prefixed = bytes.length >= 4 && 4 + bytes.readUInt32BE(0) * 32 === bytes.length;
  const fields: bigint[] = [];
  for (let index = prefixed ? 4 : 0; index + 32 <= bytes.length; index += 32) {
    fields.push(BigInt(`0x${bytes.subarray(index, index + 32).toString('hex')}`));
  }
  return fields;
}

export function assertPinnedSignals(
  publicHex: string,
  nIns: number,
  outputs: readonly PinnedNote[],
): void {
  const fields = signalFields(publicHex);
  for (const [index, output] of outputs.entries()) {
    const signal = fields[nIns + index];
    if (
      signal === undefined ||
      signal % FR_ORDER !== BigInt(output.commitment) % FR_ORDER
    ) {
      throw new Error('Proof commitments do not match the pinned outputs');
    }
  }
}

export function withdrawAddress(
  amount: bigint,
  recipient: string,
): { hi: string; lo: string } {
  if (amount === 0n) {
    return { hi: '0', lo: '0' };
  }
  const raw = Buffer.from(StrKey.decodeEd25519PublicKey(recipient)).toString('hex');
  return ed25519PubkeyPayloadHexToWithdrawFrDecimals(raw);
}

export function auditPoint(hex: string): FieldPair {
  const clean = stripHexPrefix(hex).trim();
  if (clean.length !== 128) {
    throw new Error('Audit public key must be 64-byte X+Y hex');
  }
  return [hexToDecimal(clean.slice(0, 64)), hexToDecimal(clean.slice(64))];
}
