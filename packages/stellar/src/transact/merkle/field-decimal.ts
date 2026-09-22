import { Buffer } from 'buffer';

const BN254 =
  21_888_242_871_839_275_222_246_405_745_257_275_088_548_364_400_416_034_343_698_204_186_575_808_495_617n;
const MERKLE_ROOT_BYTE_LENGTH = 32;
const DECIMAL_STRING_RADIX = 10;

export function merkleRootBufferToFrDecimal(root: Buffer): string {
  if (root.length !== MERKLE_ROOT_BYTE_LENGTH) {
    throw new Error(
      `expected ${MERKLE_ROOT_BYTE_LENGTH}-byte merkle root, got ${root.length}`,
    );
  }
  const hex = Buffer.from(root).toString('hex');
  return (BigInt(`0x${hex}`) % BN254).toString(DECIMAL_STRING_RADIX);
}

const MERKLE_ROOT_HEX_PATTERN = /^[0-9a-fA-F]{64}$/;

export function merkleRootHexToFrDecimal(merkleRootHex: string): string | undefined {
  const trimmed = merkleRootHex.trim();
  if (!MERKLE_ROOT_HEX_PATTERN.test(trimmed)) {
    return undefined;
  }
  return merkleRootBufferToFrDecimal(Buffer.from(trimmed, 'hex'));
}
