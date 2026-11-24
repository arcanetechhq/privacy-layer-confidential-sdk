import type { RelayTransactPackageV1 } from '@arcanetech/privacy-sdk-stellar/transact';
import { deriveInterestDepositSeed } from './derive-interest-deposit-seed.js';
import { interestDepositAccount } from './interest-deposit-account.js';
import { buildPlacementEnvelope } from './placement-envelope.js';
import { placementAuthorization } from './placement-authorization.js';
import {
  assertPublicWithdrawalPays,
  publicSignalFields,
  interestDepositRelayPackage,
  publicSignalBytes,
  SIX_BY_SIX_BINDING_STATE_ROOT_INDEX,
} from './placement-signals.js';
import { underlyingFromShares } from './underlying.js';

export interface PlacementTransaction {
  chainIndex: number;
  account: string;
  envelope: string;
  relay: RelayTransactPackageV1;
  underlying: bigint;
}

export interface PlacementTransactionInput {
  spendScalar: Uint8Array;
  blendPoolContractId: Uint8Array;
  tokenContractId: Uint8Array;
  publicSignals: string;
  ciphertext: Uint8Array;
  proof: Uint8Array;
  amount: bigint;
  adapterContractId: string;
  blendPool: string;
  reserve: string;
  poolContractId: string;
  relayAccount: string;
  networkPassphrase: string;
  sourceSequence: string;
  signatureExpirationLedger: number;
  kytExpirationLedger: number;
  kytSignature: Uint8Array;
  applicationIdHints: string[];
  recordedShares: bigint;
  exchangeRate: bigint;
  chainIndex: number;
}

export async function placementTransaction(
  input: PlacementTransactionInput,
): Promise<PlacementTransaction> {
  const seed = await deriveInterestDepositSeed({
    spendScalar: input.spendScalar,
    blendPoolContractId: input.blendPoolContractId,
    tokenContractId: input.tokenContractId,
    chainIndex: input.chainIndex,
  });
  const account = interestDepositAccount(seed);
  const relay = interestDepositRelayPackage(input);
  assertPublicWithdrawalPays({ relay, account, amount: input.amount });
  const authorization = await placementAuthorization({
    publicSignals: publicSignalFields(input.publicSignals),
    stateRootIndex: SIX_BY_SIX_BINDING_STATE_ROOT_INDEX,
    ciphertext: input.ciphertext,
  });
  const envelope = await buildPlacementEnvelope({
    ...input,
    seed,
    account,
    signedSignals: authorization.signedSignals,
    publicSignals: publicSignalBytes(input.publicSignals),
  });
  return {
    chainIndex: input.chainIndex,
    account,
    envelope,
    relay,
    underlying: underlyingFromShares(input.recordedShares, input.exchangeRate),
  };
}
