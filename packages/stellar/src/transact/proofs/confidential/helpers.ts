import {
  withdrawObjectFromEscrowMerkleWitness,
  withdrawObjectFromMerkleWitness,
} from '@arcanetech/stellar-privacy-pool-zk-sdk';
import type {
  CoinData,
  PrivacyPoolSDK,
  StateFile,
} from '@arcanetech/stellar-privacy-pool-zk-sdk';
import { withdrawMerkleWitnessFromTree } from '../../merkle/tree-session.js';

export const MIN_CONFIDENTIAL_TRANSFER_STROOPS = 1n;
export const ZERO_STROOPS = 0n;

export type EscrowSpendWitness = {
  nonce: string;
  recipientHi: string;
  recipientLo: string;
  derivedScalarHex: string;
};

export function escrowSpendWitnessFromLimbs(
  limbs: {
    nonceDecimal?: string;
    recipientHi: string;
    recipientLo: string;
  },
  derivedScalarHex: string,
): EscrowSpendWitness {
  const nonce = limbs.nonceDecimal?.trim() ?? '';
  if (!nonce) {
    throw new Error('Escrow claimant limbs require nonceDecimal');
  }
  return {
    nonce,
    recipientHi: limbs.recipientHi,
    recipientLo: limbs.recipientLo,
    derivedScalarHex,
  };
}

export function withdrawWitnessForCoin(parameters: {
  sdk: PrivacyPoolSDK;
  coin: CoinData;
  state: StateFile;
  ownerPubHex: { x: string; y: string };
  privKeyScalar: string;
  applicationId: string;
  escrow?: EscrowSpendWitness;
}) {
  const { sdk, coin, state } = parameters;
  const witness = withdrawMerkleWitnessFromTree({ sdk, coin, state });
  const withdrawApplicationId = coin.application_id ?? parameters.applicationId;
  const withdrawObject = parameters.escrow
    ? withdrawObjectFromEscrowMerkleWitness(
        witness,
        parameters.ownerPubHex,
        withdrawApplicationId,
        parameters.escrow.derivedScalarHex,
        {
          nonce: parameters.escrow.nonce,
          recipientHi: parameters.escrow.recipientHi,
          recipientLo: parameters.escrow.recipientLo,
        },
      )
    : withdrawObjectFromMerkleWitness(
        witness,
        parameters.ownerPubHex,
        withdrawApplicationId,
        parameters.privKeyScalar,
      );
  return { witness, withdrawObject };
}

export function dualWithdrawLegsWithSharedRoot(parameters: {
  sdk: PrivacyPoolSDK;
  coinA: CoinData;
  coinB: CoinData;
  state: StateFile;
  ownerPubHex: { x: string; y: string };
  privKeyScalar: string;
  applicationId: string;
  escrow?: EscrowSpendWitness;
}) {
  const shared = {
    sdk: parameters.sdk,
    state: parameters.state,
    ownerPubHex: parameters.ownerPubHex,
    privKeyScalar: parameters.privKeyScalar,
    applicationId: parameters.applicationId,
    ...(parameters.escrow ? { escrow: parameters.escrow } : {}),
  };
  const legA = withdrawWitnessForCoin({
    ...shared,
    coin: parameters.coinA,
  });
  const legB = withdrawWitnessForCoin({
    ...shared,
    coin: parameters.coinB,
  });
  if (legA.witness.stateRoot !== legB.witness.stateRoot) {
    throw new Error('Merkle state root mismatch between input coins');
  }
  return { legA, legB };
}

export function requireChangeRecipientWhenPartial(
  changeStroops: bigint,
  selfPrivateAddressStpl1ForChange: string | undefined,
): void {
  if (changeStroops > ZERO_STROOPS) {
    const stpl1 = selfPrivateAddressStpl1ForChange?.trim() ?? '';
    if (!stpl1) {
      throw new Error(
        'Private address is required to receive the remaining balance after a partial transfer',
      );
    }
  }
}
