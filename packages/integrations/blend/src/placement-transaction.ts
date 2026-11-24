import type { RelayTransactPackageV1 } from '@arcanetech/privacy-sdk-stellar/transact';
import { deriveInterestDepositSeed } from './derive-interest-deposit-seed.js';
import { interestDepositAccount } from './interest-deposit-account.js';
import { buildPlacementEnvelope } from './placement-envelope.js';
import { placementAuthorization } from './placement-authorization.js';
import {
  assertPublicWithdrawalPays,
  publicSignalFields,
  publicWithdrawalRelayPackage,
  SIX_BY_SIX_BINDING_STATE_ROOT_INDEX,
} from './placement-signals.js';
import { underlyingFromShares } from './underlying.js';

const CHAIN_INDEX_0 = 0;

export interface PlacementTransaction {
  chainIndex: typeof CHAIN_INDEX_0;
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
}

export async function placementTransaction(
  input: PlacementTransactionInput,
): Promise<PlacementTransaction> {
  const seed = await deriveInterestDepositSeed({
    spendScalar: input.spendScalar,
    blendPoolContractId: input.blendPoolContractId,
    tokenContractId: input.tokenContractId,
    chainIndex: CHAIN_INDEX_0,
  });
  const account = interestDepositAccount(seed);
  const relay = publicWithdrawalRelayPackage(input);
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
    publicSignals: signalBytes(input.publicSignals),
  });
  return {
    chainIndex: CHAIN_INDEX_0,
    account,
    envelope,
    relay,
    underlying: underlyingFromShares(input.recordedShares, input.exchangeRate),
  };
}

function signalBytes(publicSignals: string): Uint8Array {
  return Buffer.from(publicSignals.replace(/^0x/iu, ''), 'hex');
}
