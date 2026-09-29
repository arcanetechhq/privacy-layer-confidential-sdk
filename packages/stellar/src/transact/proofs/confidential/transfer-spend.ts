import type { CoinData, StateFile } from '@arcanetech/stellar-privacy-pool-zk-sdk';
import {
  escrowSpendWitnessFromLimbs,
  withdrawWitnessForCoin,
} from '../../proofs/confidential/helpers.js';
import { resolveTransferSpendScalars } from '../../encoding/priv-key-scalar-from-recipient-hex.js';
import { stampWithdrawEscrowLimbs, sweepWithdrawStamp } from './shared.js';
import type {
  TransferEscrowClaimantLimbs,
  TransferEscrowSend,
} from '../../environment/types.js';
import type { FeeOutputSpec } from '../../fees/append-fee-output.js';
import { getPrivacyPoolService } from '../../pool/singleton.js';

type TransferProofInput = {
  coin: CoinData;
  state: StateFile;
  senderPrivKeyScalarHex: string;
  transferStroops: bigint;
  recipientPrivateAddressStpl1: string;
  selfPrivateAddressStpl1ForChange: string | undefined;
  tokenAddress: string;
  escrowSend?: TransferEscrowSend;
  escrowClaimantLimbs?: TransferEscrowClaimantLimbs;
  feeOutput?: FeeOutputSpec;
};

type InitializedPrivacySdk = Awaited<
  ReturnType<ReturnType<typeof getPrivacyPoolService>['getInitializedSdk']>
>;

export function confidentialEscrowFields(input: {
  escrowSend?: TransferEscrowSend;
  escrowClaimantLimbs?: TransferEscrowClaimantLimbs;
}) {
  return {
    ...(input.escrowSend ? { escrowSend: input.escrowSend } : {}),
    ...(input.escrowClaimantLimbs
      ? { escrowClaimantLimbs: input.escrowClaimantLimbs }
      : {}),
  };
}

export function transferDepositInputFromProof(
  input: TransferProofInput,
  changeStroops: bigint,
  stateRoot: string,
) {
  return {
    senderPrivKeyScalarHex: input.senderPrivKeyScalarHex,
    recipientPrivateAddressStpl1: input.recipientPrivateAddressStpl1,
    transferStroops: input.transferStroops,
    changeStroops,
    selfPrivateAddressStpl1ForChange: input.selfPrivateAddressStpl1ForChange,
    tokenAddress: input.tokenAddress,
    stateRoot,
    ...confidentialEscrowFields(input),
    ...(input.feeOutput ? { feeOutput: input.feeOutput } : {}),
  };
}

export function spendWithdrawForTransfer(parameters: {
  sdk: InitializedPrivacySdk;
  applicationId: string;
  input: TransferProofInput;
}) {
  const limbs = parameters.input.escrowClaimantLimbs;
  const { privKeyScalar, ownerScalarHex } = resolveTransferSpendScalars({
    senderPrivKeyScalarHex: parameters.input.senderPrivKeyScalarHex,
    escrowSweep: Boolean(limbs),
  });
  const spent = withdrawWitnessForCoin({
    sdk: parameters.sdk,
    coin: parameters.input.coin,
    state: parameters.input.state,
    ownerPubHex: parameters.sdk.ecdhEphemeralPublicKeyFromScalarHex(ownerScalarHex),
    privKeyScalar,
    applicationId: parameters.applicationId,
    ...(limbs
      ? {
          escrow: escrowSpendWitnessFromLimbs(
            limbs,
            parameters.input.senderPrivKeyScalarHex,
          ),
        }
      : {}),
  });
  if (limbs) {
    return spent;
  }
  return {
    witness: spent.witness,
    withdrawObject: stampWithdrawEscrowLimbs(
      spent.withdrawObject,
      sweepWithdrawStamp(confidentialEscrowFields(parameters.input)),
    ),
  };
}
