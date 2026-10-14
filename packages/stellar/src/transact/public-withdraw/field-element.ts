import { Buffer } from 'buffer';

const FIELD_HEX_LENGTH = 64;

function fieldElementToBigInt(value: string): bigint {
  const trimmed = value.trim();
  if (trimmed.startsWith('0x') || trimmed.startsWith('0X')) {
    return BigInt(trimmed);
  }
  if (/[a-fA-F]/.test(trimmed)) {
    return BigInt(`0x${trimmed}`);
  }
  return BigInt(trimmed);
}

export function fieldElementToBytes(value: string): Buffer {
  const hex = fieldElementToBigInt(value).toString(16).padStart(FIELD_HEX_LENGTH, '0');
  if (hex.length !== FIELD_HEX_LENGTH) {
    throw new Error(`Field element ${value} does not fit 32 bytes.`);
  }
  return Buffer.from(hex, 'hex');
}

export function findCommitmentLeafIndex(
  commitments: readonly string[],
  commitment: string,
): number | undefined {
  const target = fieldElementToBigInt(commitment);
  const index = commitments.findIndex((leaf) => fieldElementToBigInt(leaf) === target);
  return index === -1 ? undefined : index;
}
