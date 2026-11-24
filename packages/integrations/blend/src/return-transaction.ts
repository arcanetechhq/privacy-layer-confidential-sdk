import type { RelayTransactPackageV1 } from '@arcanetech/privacy-sdk-stellar/transact';
import { deriveInterestDepositSeed } from './derive-interest-deposit-seed.js';
import { interestDepositAccount } from './interest-deposit-account.js';
import { placementAuthorization } from './placement-authorization.js';
import {
  assertPublicDepositReturns,
  publicSignalFields,
  publicWithdrawalRelayPackage,
  SIX_BY_SIX_BINDING_STATE_ROOT_INDEX,
} from './placement-signals.js';
import { buildReturnEnvelope, type ReturnLegDraft } from './return-envelope.js';

export interface ReturnLeg {
  spendScalar: Uint8Array;
  chainIndex: number;
  amount: bigint;
}

export interface ReturnTransaction {
  envelope: string;
  relay: RelayTransactPackageV1;
  accounts: string[];
}

export interface ReturnTransactionInput {
  legs: ReturnLeg[];
  blendPoolContractId: Uint8Array;
  tokenContractId: Uint8Array;
  publicSignals: string;
  ciphertext: Uint8Array;
  proof: Uint8Array;
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
}

export async function returnTransaction(
  input: ReturnTransactionInput,
): Promise<ReturnTransaction> {
  const legs = await Promise.all(input.legs.map((leg) => derivedLeg(input, leg)));
  const relay = publicWithdrawalRelayPackage(input);
  assertPublicDepositReturns({
    relay,
    reserve: input.reserve,
    amount: underlyingTotal(input.legs),
  });
  const authorization = await placementAuthorization({
    publicSignals: publicSignalFields(input.publicSignals),
    stateRootIndex: SIX_BY_SIX_BINDING_STATE_ROOT_INDEX,
    ciphertext: input.ciphertext,
  });
  const envelope = await buildReturnEnvelope({
    ...input,
    legs,
    signedSignals: authorization.signedSignals,
    publicSignals: signalBytes(input.publicSignals),
  });
  return {
    envelope,
    relay,
    accounts: legs.map((leg) => leg.account),
  };
}

async function derivedLeg(
  input: ReturnTransactionInput,
  leg: ReturnLeg,
): Promise<ReturnLegDraft> {
  const seed = await deriveInterestDepositSeed({
    spendScalar: leg.spendScalar,
    blendPoolContractId: input.blendPoolContractId,
    tokenContractId: input.tokenContractId,
    chainIndex: leg.chainIndex,
  });
  return {
    seed,
    account: interestDepositAccount(seed),
    amount: leg.amount,
  };
}

function underlyingTotal(legs: readonly ReturnLeg[]): bigint {
  return legs.reduce((sum, leg) => sum + leg.amount, 0n);
}

function signalBytes(publicSignals: string): Uint8Array {
  return Buffer.from(publicSignals.replace(/^0x/iu, ''), 'hex');
}
