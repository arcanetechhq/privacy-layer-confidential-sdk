import { withdrawObjectFromMerkleWitness } from '@arcanetech/stellar-privacy-pool-zk-sdk';
import type {
  CoinData,
  DepositSlot,
  PrivacyPoolSDK,
  StateFile,
} from '@arcanetech/stellar-privacy-pool-zk-sdk';
import { buildPublicWithdrawLegs } from '../../proofs/transaction-input.js';
import {
  buildApplicationIdHints,
  padDepositSlotsToLayout,
  padPublicLegsToLayout,
  padWithdrawSlotsToLayout,
} from '../../zk/slots.js';
import { MIN_CONFIDENTIAL_TRANSFER_STROOPS } from '../../proofs/confidential/helpers.js';
import { withdrawMerkleWitnessFromTree } from '../../merkle/tree-session.js';
import { remainingAfterRequiredFee } from '../../fees/quote-fee-output-for-prepared.js';
import type { FeeOutputSpec } from '../../fees/append-fee-output.js';
import { buildPoolTransactionAuditParameters } from '../../audit/parameters.js';
import {
  buildWithdrawPublicInput,
  prepareDualWithdrawProofInputs,
  type AlignedDepositSlotBuilder,
  type DualWithdrawProofParameters,
  type WithdrawChangeCoin,
} from '../../proofs/withdraw/helpers.js';
import {
  withdrawDepositsWithFee,
  withdrawOutputApplicationIds,
} from '../../proofs/withdraw/fee-deposits.js';
import type { KytApplicationIdHints } from '../../pool/proof-types.js';
import { privKeyScalarDecimalFromRecipientScalarHex } from '../../encoding/priv-key-scalar-from-recipient-hex.js';

function validateSingleWithdrawAmounts(
  withdrawAmountStroops: bigint,
  noteStroops: bigint,
  requiredFee: bigint,
): bigint {
  if (withdrawAmountStroops < MIN_CONFIDENTIAL_TRANSFER_STROOPS) {
    throw new Error('Withdraw amount must be positive');
  }
  return remainingAfterRequiredFee({
    available: noteStroops,
    instructed: withdrawAmountStroops,
    requiredFee,
  });
}

async function proveSingleWithdrawTransaction(parameters: {
  sdk: PrivacyPoolSDK;
  publicInput: ReturnType<typeof buildWithdrawPublicInput>;
  audit: ReturnType<typeof buildPoolTransactionAuditParameters>;
  primaryWithdraw: ReturnType<typeof withdrawObjectFromMerkleWitness>;
  deposits: DepositSlot[];
  tokenAddress: string;
  withdrawAmountStroops: bigint;
}) {
  return parameters.sdk.proveTransaction(
    parameters.publicInput as unknown as Parameters<
      typeof parameters.sdk.proveTransaction
    >[0],
    padPublicLegsToLayout(
      parameters.sdk,
      buildPublicWithdrawLegs(
        parameters.tokenAddress,
        parameters.withdrawAmountStroops.toString(),
      ),
    ),
    padWithdrawSlotsToLayout(parameters.sdk, [parameters.primaryWithdraw]),
    padDepositSlotsToLayout(parameters.sdk, parameters.deposits),
    parameters.audit,
  );
}

function buildPrimaryWithdrawForCoin(parameters: {
  sdk: PrivacyPoolSDK;
  applicationId: string;
  coin: CoinData;
  state: StateFile;
  privKeyScalarHex: string;
}) {
  const witness = withdrawMerkleWitnessFromTree({
    sdk: parameters.sdk,
    coin: parameters.coin,
    state: parameters.state,
  });
  const privKeyScalar = privKeyScalarDecimalFromRecipientScalarHex(
    parameters.privKeyScalarHex,
  );
  const ownerPubHex = parameters.sdk.ecdhEphemeralPublicKeyFromScalarHex(
    parameters.privKeyScalarHex,
  );
  const primaryWithdraw = withdrawObjectFromMerkleWitness(
    witness,
    ownerPubHex,
    parameters.applicationId,
    privKeyScalar,
  );
  return { witness, primaryWithdraw };
}

type SingleWithdrawProofInputParams = {
  sdk: PrivacyPoolSDK;
  applicationId: string;
  buildAlignedDepositSlot: AlignedDepositSlotBuilder;
  coin: CoinData;
  state: StateFile;
  destinationStellarAddress: string;
  privKeyScalarHex: string;
  depositorEphemeralKey: string;
  withdrawAmountStroops: bigint;
  changePrivateAddressStpl1: string | undefined;
  tokenAddress: string;
  auditPublicKey?: [string, string];
  feeOutput?: FeeOutputSpec;
};

async function prepareSingleWithdrawProofInputs(
  parameters: SingleWithdrawProofInputParams,
) {
  const changeStroops = validateSingleWithdrawAmounts(
    parameters.withdrawAmountStroops,
    BigInt(parameters.coin.value),
    parameters.feeOutput?.requiredFee ?? 0n,
  );
  const { witness, primaryWithdraw } = buildPrimaryWithdrawForCoin({
    sdk: parameters.sdk,
    applicationId: parameters.applicationId,
    coin: parameters.coin,
    state: parameters.state,
    privKeyScalarHex: parameters.privKeyScalarHex,
  });
  const { deposits, changeCoin, feeCoin } = await withdrawDepositsWithFee({
    changeStroops,
    changePrivateAddressStpl1: parameters.changePrivateAddressStpl1,
    buildAlignedDepositSlot: parameters.buildAlignedDepositSlot,
    tokenAddress: parameters.tokenAddress,
    ...(parameters.feeOutput ? { feeOutput: parameters.feeOutput } : {}),
  });
  const publicInput = buildWithdrawPublicInput({
    stateRoot: witness.stateRoot,
    destinationStellarAddress: parameters.destinationStellarAddress,
    privKeyScalarHex: parameters.privKeyScalarHex,
    tokenAddress: parameters.tokenAddress,
    publicWithdrawalAmount: parameters.withdrawAmountStroops.toString(),
  });
  return {
    primaryWithdraw,
    deposits,
    changeCoin,
    feeCoin,
    publicInput,
    audit: buildPoolTransactionAuditParameters({
      applicationId: parameters.applicationId,
      nAuditSlots: parameters.sdk.getLayout().nAuditSlots,
      ...(parameters.auditPublicKey
        ? { auditPublicKey: parameters.auditPublicKey }
        : {}),
    }),
  };
}

export async function proveWithdrawTransact(parameters: {
  sdk: PrivacyPoolSDK;
  applicationId: string;
  buildAlignedDepositSlot: AlignedDepositSlotBuilder;
  coin: CoinData;
  state: StateFile;
  destinationStellarAddress: string;
  privKeyScalarHex: string;
  depositorEphemeralKey: string;
  withdrawAmountStroops: bigint;
  changePrivateAddressStpl1: string | undefined;
  tokenAddress: string;
  auditPublicKey?: [string, string];
  feeOutput?: FeeOutputSpec;
}): Promise<{
  proof_hex: string;
  public_hex: string;
  ciphertext_hex?: string;
  output_note_ephemeral_scalars?: string[];
  applicationIdsPlaintext: KytApplicationIdHints;
  changeCoin?: WithdrawChangeCoin;
}> {
  const { primaryWithdraw, deposits, changeCoin, feeCoin, publicInput, audit } =
    await prepareSingleWithdrawProofInputs(parameters);
  const proof = await proveSingleWithdrawTransaction({
    sdk: parameters.sdk,
    publicInput,
    audit,
    primaryWithdraw,
    deposits,
    tokenAddress: parameters.tokenAddress,
    withdrawAmountStroops: parameters.withdrawAmountStroops,
  });
  return {
    ...proof,
    applicationIdsPlaintext: buildApplicationIdHints({
      sdk: parameters.sdk,
      inputIds: [parameters.applicationId],
      outputIds: withdrawOutputApplicationIds({
        applicationId: parameters.applicationId,
        hasChange: Boolean(changeCoin),
        hasFeeOutput: Boolean(feeCoin),
      }),
    }),
    ...(changeCoin ? { changeCoin } : {}),
  };
}

export async function proveWithdrawTransactDual(
  parameters: DualWithdrawProofParameters & { applicationId: string },
): Promise<{
  proof_hex: string;
  public_hex: string;
  ciphertext_hex?: string;
  output_note_ephemeral_scalars?: string[];
  applicationIdsPlaintext: KytApplicationIdHints;
  changeCoin?: WithdrawChangeCoin;
}> {
  const { publicInput, audit, withdrawLegs, deposits, changeCoin, feeCoin } =
    await prepareDualWithdrawProofInputs(parameters);
  const proof = await parameters.sdk.proveTransaction(
    publicInput as unknown as Parameters<typeof parameters.sdk.proveTransaction>[0],
    padPublicLegsToLayout(
      parameters.sdk,
      buildPublicWithdrawLegs(
        parameters.tokenAddress,
        parameters.withdrawAmountStroops.toString(),
      ),
    ),
    padWithdrawSlotsToLayout(parameters.sdk, withdrawLegs),
    padDepositSlotsToLayout(parameters.sdk, deposits),
    audit,
  );
  return {
    ...proof,
    applicationIdsPlaintext: buildApplicationIdHints({
      sdk: parameters.sdk,
      inputIds: [audit.applicationId, audit.applicationId],
      outputIds: withdrawOutputApplicationIds({
        applicationId: audit.applicationId,
        hasChange: Boolean(changeCoin),
        hasFeeOutput: Boolean(feeCoin),
      }),
    }),
    ...(changeCoin ? { changeCoin } : {}),
  };
}

export { type AlignedDepositSlotBuilder } from '../../proofs/withdraw/helpers.js';
