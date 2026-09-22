import { withdrawObjectFromMerkleWitness } from '@arcanetech/stellar-privacy-pool-zk-sdk';
import type {
  CoinData,
  PrivacyPoolSDK,
  StateFile,
} from '@arcanetech/stellar-privacy-pool-zk-sdk';
import { withdrawMerkleWitnessFromTree } from '../../merkle/tree-session.js';

export const MIN_CONFIDENTIAL_TRANSFER_STROOPS = 1n;
export const ZERO_STROOPS = 0n;

export function withdrawWitnessForCoin(parameters: {
  sdk: PrivacyPoolSDK;
  coin: CoinData;
  state: StateFile;
  ownerPubHex: { x: string; y: string };
  privKeyScalar: string;
  applicationId: string;
}) {
  const { sdk, coin, state } = parameters;
  const witness = withdrawMerkleWitnessFromTree({ sdk, coin, state });
  const withdrawApplicationId = coin.application_id ?? parameters.applicationId;
  const withdrawObject = withdrawObjectFromMerkleWitness(
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
}) {
  const legA = withdrawWitnessForCoin({
    sdk: parameters.sdk,
    coin: parameters.coinA,
    state: parameters.state,
    ownerPubHex: parameters.ownerPubHex,
    privKeyScalar: parameters.privKeyScalar,
    applicationId: parameters.applicationId,
  });
  const legB = withdrawWitnessForCoin({
    sdk: parameters.sdk,
    coin: parameters.coinB,
    state: parameters.state,
    ownerPubHex: parameters.ownerPubHex,
    privKeyScalar: parameters.privKeyScalar,
    applicationId: parameters.applicationId,
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
