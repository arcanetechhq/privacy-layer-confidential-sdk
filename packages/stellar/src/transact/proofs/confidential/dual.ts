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
  dualWithdrawLegsWithSharedRoot,
  escrowSpendWitnessFromLimbs,
  MIN_CONFIDENTIAL_TRANSFER_STROOPS,
  requireChangeRecipientWhenPartial,
} from '../../proofs/confidential/helpers.js';
import { buildPoolTransactionAuditParameters } from '../../audit/parameters.js';
import type { KytApplicationIdHints } from '../../pool/proof-types.js';
import {
  buildSenderTransferDepositsAndPublicInput,
  generatedOutputCoinFromSlot,
  stampWithdrawEscrowLimbs,
  sweepWithdrawStamp,
  type GeneratedOutputCoin,
} from './shared.js';
import { resolveTransferSpendScalars } from '../../encoding/priv-key-scalar-from-recipient-hex.js';
import { confidentialEscrowFields } from './transfer-spend.js';
import type {
  TransferEscrowClaimantLimbs,
  TransferEscrowSend,
} from '../../environment/types.js';
import type { FeeOutputSpec } from '../../fees/append-fee-output.js';
import { remainingAfterRequiredFee } from '../../fees/quote-fee-output-for-prepared.js';

type PrepareConfidentialTransferProofDualParameters = {
  coinA: CoinData;
  coinB: CoinData;
  state: StateFile;
  senderPrivKeyScalarHex: string;
  ephemeralAKey: string;
  ephemeralBKey: string;
  transferStroops: bigint;
  recipientPrivateAddressStpl1: string;
  selfPrivateAddressStpl1ForChange: string | undefined;
  tokenAddress: string;
  escrowSend?: TransferEscrowSend;
  escrowClaimantLimbs?: TransferEscrowClaimantLimbs;
  feeOutput?: FeeOutputSpec;
};

type PrepareConfidentialTransferProofDualResult = {
  proof_hex: string;
  public_hex: string;
  ciphertext_hex?: string;
  output_note_ephemeral_scalars?: string[];
  applicationIdsPlaintext: KytApplicationIdHints;
  recipientCoin: GeneratedOutputCoin;
  changeCoin?: GeneratedOutputCoin;
};

function stampDualWithdrawLegs(
  legs: ReturnType<typeof dualWithdrawLegsWithSharedRoot>,
  parameters: PrepareConfidentialTransferProofDualParameters,
) {
  if (parameters.escrowClaimantLimbs) {
    return legs;
  }
  const escrowLimbs = sweepWithdrawStamp(confidentialEscrowFields(parameters));
  return {
    legA: {
      ...legs.legA,
      withdrawObject: stampWithdrawEscrowLimbs(legs.legA.withdrawObject, escrowLimbs),
    },
    legB: {
      ...legs.legB,
      withdrawObject: stampWithdrawEscrowLimbs(legs.legB.withdrawObject, escrowLimbs),
    },
  };
}

function buildDualTransferApplicationIds(
  sdk: Awaited<
    ReturnType<ReturnType<typeof getPrivacyPoolService>['getInitializedSdk']>
  >,
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
    inputIds: [applicationId, applicationId],
    outputIds,
  });
}

async function proveDualConfidentialTransfer(parameters: {
  sdk: Awaited<
    ReturnType<ReturnType<typeof getPrivacyPoolService>['getInitializedSdk']>
  >;
  publicInput: Awaited<
    ReturnType<typeof buildSenderTransferDepositsAndPublicInput>
  >['publicInput'];
  legA: Awaited<ReturnType<typeof dualWithdrawLegsWithSharedRoot>>['legA'];
  legB: Awaited<ReturnType<typeof dualWithdrawLegsWithSharedRoot>>['legB'];
  deposits: Awaited<
    ReturnType<typeof buildSenderTransferDepositsAndPublicInput>
  >['deposits'];
  applicationId: string;
  auditPublicKey?: [string, string];
}) {
  const audit = buildPoolTransactionAuditParameters({
    applicationId: parameters.applicationId,
    nAuditSlots: parameters.sdk.getLayout().nAuditSlots,
    ...(parameters.auditPublicKey ? { auditPublicKey: parameters.auditPublicKey } : {}),
  });
  return parameters.sdk.proveTransaction(
    parameters.publicInput as unknown as Parameters<
      typeof parameters.sdk.proveTransaction
    >[0],
    padPublicLegsToLayout(parameters.sdk, buildZeroPublicLegs()),
    padWithdrawSlotsToLayout(parameters.sdk, [
      parameters.legA.withdrawObject,
      parameters.legB.withdrawObject,
    ]),
    padDepositSlotsToLayout(parameters.sdk, parameters.deposits),
    audit,
  );
}

function dualTransferChangeStroops(
  parameters: PrepareConfidentialTransferProofDualParameters,
): bigint {
  const totalNotes = BigInt(parameters.coinA.value) + BigInt(parameters.coinB.value);
  if (parameters.transferStroops < MIN_CONFIDENTIAL_TRANSFER_STROOPS) {
    throw new Error('Transfer amount must be positive');
  }
  const changeStroops = remainingAfterRequiredFee({
    available: totalNotes,
    instructed: parameters.transferStroops,
    requiredFee: parameters.feeOutput?.requiredFee ?? 0n,
  });
  requireChangeRecipientWhenPartial(
    changeStroops,
    parameters.selfPrivateAddressStpl1ForChange,
  );
  return changeStroops;
}

async function buildDualTransferProofContext(
  parameters: PrepareConfidentialTransferProofDualParameters,
  applicationId: string,
  sdk: Awaited<
    ReturnType<ReturnType<typeof getPrivacyPoolService>['getInitializedSdk']>
  >,
) {
  const changeStroops = dualTransferChangeStroops(parameters);
  const limbs = parameters.escrowClaimantLimbs;
  const { privKeyScalar, ownerScalarHex } = resolveTransferSpendScalars({
    senderPrivKeyScalarHex: parameters.senderPrivKeyScalarHex,
    escrowSweep: Boolean(limbs),
  });
  const ownerPubHex = sdk.ecdhEphemeralPublicKeyFromScalarHex(ownerScalarHex);
  const { legA, legB } = stampDualWithdrawLegs(
    dualWithdrawLegsWithSharedRoot({
      sdk,
      coinA: parameters.coinA,
      coinB: parameters.coinB,
      state: parameters.state,
      ownerPubHex,
      privKeyScalar,
      applicationId,
      ...(limbs
        ? {
            escrow: escrowSpendWitnessFromLimbs(
              limbs,
              parameters.senderPrivKeyScalarHex,
            ),
          }
        : {}),
    }),
    parameters,
  );
  const transferInputs = await buildSenderTransferDepositsAndPublicInput({
    senderPrivKeyScalarHex: parameters.senderPrivKeyScalarHex,
    recipientPrivateAddressStpl1: parameters.recipientPrivateAddressStpl1,
    transferStroops: parameters.transferStroops,
    changeStroops,
    selfPrivateAddressStpl1ForChange: parameters.selfPrivateAddressStpl1ForChange,
    tokenAddress: parameters.tokenAddress,
    stateRoot: legA.witness.stateRoot,
    ...confidentialEscrowFields(parameters),
    ...(parameters.feeOutput ? { feeOutput: parameters.feeOutput } : {}),
  });
  return { legA, legB, applicationId, ...transferInputs };
}

export async function prepareConfidentialTransferProofDual(
  parameters: PrepareConfidentialTransferProofDualParameters,
): Promise<PrepareConfidentialTransferProofDualResult> {
  const poolService = getPrivacyPoolService();
  const sdk = await poolService.getInitializedSdk(
    poolService.feeBearingZkConfigNonce({
      kind: 'transfer',
      ...(parameters.escrowClaimantLimbs ? { spendSource: 'escrow' } : {}),
    }),
  );
  const applicationId = poolService.getApplicationId();
  const { legA, legB, recipientSlot, deposits, changeCoin, feeCoin, publicInput } =
    await buildDualTransferProofContext(parameters, applicationId, sdk);
  const auditPublicKey = poolService.getAuditPublicKey();
  const proof = await (auditPublicKey
    ? proveDualConfidentialTransfer({
        sdk,
        publicInput,
        legA,
        legB,
        deposits,
        applicationId,
        auditPublicKey,
      })
    : proveDualConfidentialTransfer({
        sdk,
        publicInput,
        legA,
        legB,
        deposits,
        applicationId,
      }));
  return {
    ...proof,
    applicationIdsPlaintext: buildDualTransferApplicationIds(
      sdk,
      applicationId,
      changeCoin,
      feeCoin,
    ),
    recipientCoin: generatedOutputCoinFromSlot(recipientSlot),
    ...(changeCoin ? { changeCoin } : {}),
  };
}
