import {
  prepareRelayTransactPackage,
  readRelayTransactSupportedProfile,
  SIX_BY_SIX_BINDING_ZK_NONCE,
  type RelayTransactPackageV1,
} from '@arcanetech/privacy-sdk-stellar/transact';
import { Keypair, StrKey } from '@stellar/stellar-sdk';

const FIELD_BYTES = 32;
const LENGTH_PREFIX_BYTES = 4;

export const SIX_BY_SIX_BINDING_STATE_ROOT_INDEX = 44;

export function publicSignalFields(publicSignals: string): Uint8Array[] {
  const bytes = Buffer.from(publicSignals.replace(/^0x/iu, ''), 'hex');
  const body = signalBody(bytes);
  return Array.from({ length: body.length / FIELD_BYTES }, (_unused, index) =>
    body.subarray(index * FIELD_BYTES, (index + 1) * FIELD_BYTES),
  );
}

export function publicWithdrawalRelayPackage(input: {
  poolContractId: string;
  proof: Uint8Array;
  publicSignals: string;
  ciphertext: Uint8Array;
  applicationIdHints: string[];
}): RelayTransactPackageV1 {
  return prepareRelayTransactPackage({
    poolSelector: input.poolContractId,
    zkConfigNonce: SIX_BY_SIX_BINDING_ZK_NONCE,
    proofBytes: Buffer.from(input.proof).toString('hex'),
    publicSignals: input.publicSignals,
    ciphertextBytes: Buffer.from(input.ciphertext).toString('hex'),
    applicationIdHints: input.applicationIdHints,
  });
}

export function assertPublicWithdrawalPays(input: {
  relay: RelayTransactPackageV1;
  account: string;
  amount: bigint;
}): void {
  const paid = readRelayTransactSupportedProfile(input.relay).publicLegContext;
  const paysThisDeposit =
    paid.publicDepositAmount === '0' &&
    paid.publicWithdrawalAmount === input.amount.toString() &&
    paid.withdrawAddressHi === addressField(input.account, 0) &&
    paid.withdrawAddressLo === addressField(input.account, FIELD_BYTES / 2);
  if (!paysThisDeposit) {
    throw new Error('Public withdrawal does not pay this Interest Deposit.');
  }
}

export function assertPublicDepositReturns(input: {
  relay: RelayTransactPackageV1;
  reserve: string;
  amount: bigint;
}): void {
  const paid = readRelayTransactSupportedProfile(input.relay).publicLegContext;
  const returnsUnderlying =
    paid.publicWithdrawalAmount === '0' &&
    paid.publicDepositAmount === input.amount.toString() &&
    paid.publicDepositAssetHi === contractField(input.reserve, 0) &&
    paid.publicDepositAssetLo === contractField(input.reserve, FIELD_BYTES / 2);
  if (!returnsUnderlying) {
    throw new Error('Public deposit is not the requested underlying.');
  }
}

function signalBody(bytes: Buffer): Buffer {
  if (bytes.length < LENGTH_PREFIX_BYTES) {
    return bytes;
  }
  const count = bytes.readUInt32BE(0);
  if (bytes.length === LENGTH_PREFIX_BYTES + count * FIELD_BYTES) {
    return bytes.subarray(LENGTH_PREFIX_BYTES);
  }
  return bytes;
}

function contractField(contractId: string, offset: number): string {
  return fieldFromRaw(Buffer.from(StrKey.decodeContract(contractId)), offset);
}

function addressField(account: string, offset: number): string {
  return fieldFromRaw(
    Buffer.from(Keypair.fromPublicKey(account).rawPublicKey()),
    offset,
  );
}

function fieldFromRaw(raw: Buffer, offset: number): string {
  const half = raw.subarray(offset, offset + FIELD_BYTES / 2).toString('hex');
  return `${'00'.repeat(FIELD_BYTES / 2)}${half}`;
}
