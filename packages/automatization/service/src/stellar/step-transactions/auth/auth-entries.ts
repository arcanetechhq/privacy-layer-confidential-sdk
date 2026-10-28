import { createHash } from 'node:crypto';
import { Address, StrKey, nativeToScVal, xdr } from '@stellar/stellar-sdk';

function addressCredentials(
  credentials: xdr.SorobanCredentials,
): xdr.SorobanAddressCredentials | undefined {
  const kind = credentials.switch().name;
  if (kind === 'sorobanCredentialsAddress') {
    return credentials.address();
  }
  if (kind === 'sorobanCredentialsAddressV2') {
    return credentials.addressV2();
  }
  return undefined;
}

export function signerOf(entryXdr: string): string | undefined {
  const entry = xdr.SorobanAuthorizationEntry.fromXDR(entryXdr, 'base64');
  const address = addressCredentials(entry.credentials());
  return address === undefined
    ? undefined
    : Address.fromScAddress(address.address()).toString();
}

export function walletPreimage(entryXdr: string, networkPassphrase: string): string {
  const entry = xdr.SorobanAuthorizationEntry.fromXDR(entryXdr, 'base64');
  const credentials = entry.credentials();
  const address = addressCredentials(credentials);
  if (!address) {
    return entryXdr;
  }
  const fields = {
    networkId: createHash('sha256').update(networkPassphrase).digest(),
    nonce: address.nonce(),
    invocation: entry.rootInvocation(),
    signatureExpirationLedger: address.signatureExpirationLedger(),
  };
  const preimage =
    credentials.switch().name === 'sorobanCredentialsAddress'
      ? xdr.HashIdPreimage.envelopeTypeSorobanAuthorization(
          new xdr.HashIdPreimageSorobanAuthorization(fields),
        )
      : xdr.HashIdPreimage.envelopeTypeSorobanAuthorizationWithAddress(
          new xdr.HashIdPreimageSorobanAuthorizationWithAddress({
            ...fields,
            address: address.address(),
          }),
        );
  return preimage.toXDR('base64');
}

export function withWalletSignature(entryXdr: string, signed: string): string {
  const bytes = Buffer.from(signed, 'base64');
  if (bytes.length !== 64) {
    return signed;
  }
  const entry = xdr.SorobanAuthorizationEntry.fromXDR(entryXdr, 'base64');
  const address = addressCredentials(entry.credentials());
  if (!address) {
    return signed;
  }
  const publicKey = Address.fromScAddress(address.address()).toString();
  const signature = nativeToScVal(
    { public_key: StrKey.decodeEd25519PublicKey(publicKey), signature: bytes },
    { type: { public_key: ['symbol', 'bytes'], signature: ['symbol', 'bytes'] } },
  );
  address.signature(xdr.ScVal.scvVec([signature]));
  return entry.toXDR('base64');
}

export function signedEntries(
  authorization: string | undefined,
  expected: number,
): string[] | undefined {
  if (expected === 0) {
    return [];
  }
  if (authorization === undefined) {
    return undefined;
  }
  try {
    const parsed: unknown = JSON.parse(authorization);
    if (
      Array.isArray(parsed) &&
      parsed.length === expected &&
      parsed.every((entry) => typeof entry === 'string')
    ) {
      return parsed as string[];
    }
  } catch {
    return undefined;
  }
  return undefined;
}
