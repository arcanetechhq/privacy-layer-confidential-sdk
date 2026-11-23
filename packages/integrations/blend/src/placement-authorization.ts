import { SIX_BY_SIX_BINDING_ZK_NONCE } from '@arcanetech/privacy-sdk-stellar/transact';

const FIELD_BYTES = 32;

export interface PlacementAuthorization {
  zkConfigNonce: bigint;
  signedSignals: Uint8Array;
  ciphertext: Uint8Array;
  kytSignalHash: Uint8Array;
}

export async function placementAuthorization(input: {
  publicSignals: readonly Uint8Array[];
  stateRootIndex: number;
  ciphertext: Uint8Array;
}): Promise<PlacementAuthorization> {
  const signedSignals = encodeNormalizedSignals(
    input.publicSignals,
    input.stateRootIndex,
  );
  const hash = await crypto.subtle.digest('SHA-256', bytes(signedSignals));
  return {
    zkConfigNonce: SIX_BY_SIX_BINDING_ZK_NONCE,
    signedSignals,
    ciphertext: bytes(input.ciphertext),
    kytSignalHash: new Uint8Array(hash),
  };
}

function encodeNormalizedSignals(
  publicSignals: readonly Uint8Array[],
  stateRootIndex: number,
): Uint8Array {
  const encoded = new Uint8Array(4 + publicSignals.length * FIELD_BYTES);
  new DataView(encoded.buffer).setUint32(0, publicSignals.length, false);
  for (const [index, signal] of publicSignals.entries()) {
    if (index === stateRootIndex) {
      continue;
    }
    encoded.set(signal, 4 + index * FIELD_BYTES);
  }
  return encoded;
}

function bytes(value: Uint8Array): Uint8Array {
  return new Uint8Array(value);
}
