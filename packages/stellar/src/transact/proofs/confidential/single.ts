import type { CoinData, StateFile } from '@arcanetech/stellar-privacy-pool-zk-sdk';
import { getPrivacyPoolService } from '../../pool/singleton.js';
import { buildZeroPublicLegs } from '../../proofs/transaction-input.js';
import {
  buildApplicationIdHints,
  padDepositSlotsToLayout,
  padPublicLegsToLayout,
  padWithdrawSlotsToLayout,
} from '../../zk/slots.js';
import {
  MIN_CONFIDENTIAL_TRANSFER_STROOPS,
  requireChangeRecipientWhenPartial,
  withdrawWitnessForCoin,
} from '../../proofs/confidential/helpers.js';
import { buildPoolTransactionAuditParameters } from '../../audit/parameters.js';
import type { KytApplicationIdHints } from '../../pool/proof-types.js';
import {
  buildSenderTransferDepositsAndPublicInput,
  generatedOutputCoinFromSlot,
  type GeneratedOutputCoin,
} from './shared.js';
import type {
  TransferEscrowClaimantLimbs,
  TransferEscrowSend,
} from '../../environment/types.js';
import type { FeeOutputSpec } from '../../fees/append-fee-output.js';
import { remainingAfterRequiredFee } from '../../fees/quote-fee-output-for-prepared.js';
import {
  spendWithdrawForTransfer,
  transferDepositInputFromProof,
} from './transfer-spend.js';

type PrepareConfidentialTransferProofParameters = {
  coin: CoinData;
  state: StateFile;
  senderPrivKeyScalarHex: string;
  depositorEphemeralKey: string;
  transferStroops: bigint;
  recipientPrivateAddressStpl1: string;
  selfPrivateAddressStpl1ForChange: string | undefined;
  tokenAddress: string;
  escrowSend?: TransferEscrowSend;
  escrowClaimantLimbs?: TransferEscrowClaimantLimbs;
  feeOutput?: FeeOutputSpec;
};

type PrepareConfidentialTransferProofResult = {
  proof_hex: string;
  public_hex: string;
  ciphertext_hex?: string;
  output_note_ephemeral_scalars?: string[];
  applicationIdsPlaintext: KytApplicationIdHints;
  recipientCoin: GeneratedOutputCoin;
  changeCoin?: GeneratedOutputCoin;
};
type SenderTransferBuild = Awaited<
  ReturnType<typeof buildSenderTransferDepositsAndPublicInput>
>;
type InitializedPrivacySdk = Awaited<
  ReturnType<ReturnType<typeof getPrivacyPoolService>['getInitializedSdk']>
>;

function validateSingleCoinTransferAmounts(
  transferStroops: bigint,
  noteStroops: bigint,
  selfPrivateAddressStpl1ForChange: string | undefined,
  requiredFee: bigint,
): bigint {
  if (transferStroops < MIN_CONFIDENTIAL_TRANSFER_STROOPS) {
    throw new Error('Transfer amount must be positive');
  }
  const changeStroops = remainingAfterRequiredFee({
    available: noteStroops,
    instructed: transferStroops,
    requiredFee,
  });
  requireChangeRecipientWhenPartial(changeStroops, selfPrivateAddressStpl1ForChange);
  return changeStroops;
}

function buildSingleTransferApplicationIds(
  sdk: InitializedPrivacySdk,
  applicationId: string,
  changeCoin?: GeneratedOutputCoin,
  feeCoin?: GeneratedOutputCoin,
): KytApplicationIdHints {
  const outputIds = [applicationId];
  if (changeCoin) {
    outputIds.push(applicationId);
  } else if (!feeCoin) {
    outputIds.push('0');
  }
  if (feeCoin) {
    outputIds.push(applicationId);
  }
  return buildApplicationIdHints({
    sdk,
    inputIds: [applicationId],
    outputIds,
  });
}

function buildTransferAuditParameters(parameters: {
  poolService: ReturnType<typeof getPrivacyPoolService>;
  applicationId: string;
  nAuditSlots: number;
}) {
  const auditPublicKey = parameters.poolService.getAuditPublicKey();
  return buildPoolTransactionAuditParameters({
    applicationId: parameters.applicationId,
    nAuditSlots: parameters.nAuditSlots,
    ...(auditPublicKey ? { auditPublicKey } : {}),
  });
}

async function proveTransaction(parameters: {
  sdk: InitializedPrivacySdk;
  publicInput: SenderTransferBuild['publicInput'];
  withdrawObject: ReturnType<typeof withdrawWitnessForCoin>['withdrawObject'];
  deposits: SenderTransferBuild['deposits'];
  audit: ReturnType<typeof buildTransferAuditParameters>;
}) {
  return parameters.sdk.proveTransaction(
    parameters.publicInput as unknown as Parameters<
      typeof parameters.sdk.proveTransaction
    >[0],
    padPublicLegsToLayout(parameters.sdk, buildZeroPublicLegs()),
    padWithdrawSlotsToLayout(parameters.sdk, [parameters.withdrawObject]),
    padDepositSlotsToLayout(parameters.sdk, parameters.deposits),
    parameters.audit,
  );
}

type TransferProofInputs = {
  witness: ReturnType<typeof withdrawWitnessForCoin>['witness'];
  withdrawObject: ReturnType<typeof withdrawWitnessForCoin>['withdrawObject'];
  recipientSlot: SenderTransferBuild['recipientSlot'];
  deposits: SenderTransferBuild['deposits'];
  changeCoin?: SenderTransferBuild['changeCoin'];
  feeCoin?: SenderTransferBuild['feeCoin'];
  publicInput: SenderTransferBuild['publicInput'];
};

async function buildTransferProofInputs(parameters: {
  sdk: InitializedPrivacySdk;
  applicationId: string;
  input: PrepareConfidentialTransferProofParameters;
  noteStroops: bigint;
}): Promise<TransferProofInputs> {
  const changeStroops = validateSingleCoinTransferAmounts(
    parameters.input.transferStroops,
    parameters.noteStroops,
    parameters.input.selfPrivateAddressStpl1ForChange,
    parameters.input.feeOutput?.requiredFee ?? 0n,
  );
  const { witness, withdrawObject } = spendWithdrawForTransfer(parameters);
  const depositsBuild = await buildSenderTransferDepositsAndPublicInput(
    transferDepositInputFromProof(parameters.input, changeStroops, witness.stateRoot),
  );
  return { witness, withdrawObject, ...depositsBuild };
}

export async function prepareConfidentialTransferProof(
  parameters: PrepareConfidentialTransferProofParameters,
): Promise<PrepareConfidentialTransferProofResult> {
  const poolService = getPrivacyPoolService();
  const sdk = await poolService.getInitializedSdk(
    poolService.feeBearingZkConfigNonce({
      kind: 'transfer',
      ...(parameters.escrowClaimantLimbs ? { spendSource: 'escrow' } : {}),
    }),
  );
  const applicationId = poolService.getApplicationId();
  const noteStroops = BigInt(parameters.coin.value);
  const { withdrawObject, recipientSlot, deposits, changeCoin, feeCoin, publicInput } =
    await buildTransferProofInputs({
      sdk,
      applicationId,
      input: parameters,
      noteStroops,
    });
  const audit = buildTransferAuditParameters({
    poolService,
    applicationId,
    nAuditSlots: sdk.getLayout().nAuditSlots,
  });
  const proof = await proveTransaction({
    sdk,
    publicInput,
    withdrawObject,
    deposits,
    audit,
  });
  return {
    ...proof,
    applicationIdsPlaintext: buildSingleTransferApplicationIds(
      sdk,
      applicationId,
      changeCoin,
      feeCoin,
    ),
    recipientCoin: generatedOutputCoinFromSlot(recipientSlot),
    ...(changeCoin ? { changeCoin } : {}),
  };
}

export { prepareConfidentialTransferProofDual } from '../../proofs/confidential/dual.js';
