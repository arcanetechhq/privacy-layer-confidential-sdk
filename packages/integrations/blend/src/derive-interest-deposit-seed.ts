import { bufferSource } from './buffer-source.js';

const POSITION_SALT = new TextEncoder().encode('arcane-blend-position-v1');
const CONTRACT_ID_BYTES = 32;
const CHAIN_INDEX_BYTES = 4;

export async function deriveInterestDepositSeed(input: {
  spendScalar: Uint8Array;
  blendPoolContractId: Uint8Array;
  tokenContractId: Uint8Array;
  chainIndex: number;
}): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    bufferSource(input.spendScalar),
    'HKDF',
    false,
    ['deriveBits'],
  );
  const info = positionInfo(input);
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: bufferSource(POSITION_SALT),
      info: bufferSource(info),
    },
    key,
    256,
  );
  return new Uint8Array(bits);
}

function positionInfo(input: {
  blendPoolContractId: Uint8Array;
  tokenContractId: Uint8Array;
  chainIndex: number;
}): Uint8Array {
  const infoBuffer = new ArrayBuffer(
    CONTRACT_ID_BYTES + CONTRACT_ID_BYTES + CHAIN_INDEX_BYTES,
  );
  const info = new Uint8Array(infoBuffer);
  info.set(input.blendPoolContractId, 0);
  info.set(input.tokenContractId, CONTRACT_ID_BYTES);
  new DataView(infoBuffer).setUint32(CONTRACT_ID_BYTES * 2, input.chainIndex, false);
  return info;
}
