import type { WithdrawIntent } from '@arcanetech/privacy-sdk-core';
import type {
  StellarAddress,
  StellarAssetId,
  StellarPreparedOperation,
} from '../../types.js';
import type { StellarTransactEnvironment } from '../environment/types.js';
import {
  ciphertextArtifactsFromProof,
  type ProofWithChange,
} from '../pool/proof-types.js';
import type { PrivacyPoolService } from '../pool/service.js';
import { serializeEphemeralKeyString } from '../encoding/ephemeral-key.js';
import {
  buildSpendProofContextAtExecute,
  readCoinEphemeralForRecord,
} from './spend-proof-context.js';
import { finalizeTransferAtExecute } from './transfer-finalize.js';
import { withdrawFeeProofFields } from './withdraw-fee.js';
import {
  configuredNonceSpread,
  zkConfigNonceForFeeBearingKind,
} from '../fees/zk-config-nonce-for-kind.js';

function enrichWithdrawOutputRecords(
  prepared: StellarPreparedOperation,
  proof: ProofWithChange,
): void {
  if (!proof.changeCoin || prepared.outputRecords.length === 0) {
    return;
  }
  const changeCoin = proof.changeCoin;
  prepared.outputRecords = prepared.outputRecords.map((record) => ({
    ...record,
    id: changeCoin.commitment_hex,
    commitmentHex: changeCoin.commitment_hex,
    coinNote: changeCoin.coin,
    depositScalarHex: changeCoin.depositScalarHex,
    precommitementHex: changeCoin.precommitementHex,
  }));
}

function buildWithdrawFinalizeArtifacts(
  proof: ProofWithChange,
  context: Awaited<ReturnType<typeof buildSpendProofContextAtExecute>>,
  environment: StellarTransactEnvironment,
) {
  return {
    proofHex: proof.proof_hex,
    publicHex: proof.public_hex,
    ...ciphertextArtifactsFromProof(proof),
    applicationIdsPlaintext: proof.applicationIdsPlaintext,
    tokenAddress: context.tokenAddress,
    walletPublicKey: context.walletPublicKey,
    executeFinalizeRequired: false,
    zkConfigNonce: zkConfigNonceForFeeBearingKind({
      kind: 'withdraw',
      ...configuredNonceSpread(environment.zkConfigNonce),
    }),
  };
}

async function finalizeSingleWithdrawAtExecute(
  prepared: StellarPreparedOperation,
  environment: StellarTransactEnvironment,
  poolService: PrivacyPoolService,
  withdrawFrom: string,
) {
  const context = await buildSpendProofContextAtExecute({
    prepared,
    environment,
    recipientPrivateAddressStpl1: withdrawFrom,
  });
  const feeFields = await withdrawFeeProofFields({
    prepared,
    environment,
    tokenAddress: context.tokenAddress,
    available: BigInt(context.coin.value),
    withdrawFrom,
  });
  const proof = await poolService.prepareWithdrawTransactProof({
    coin: context.coin,
    state: context.merkleState,
    destinationStellarAddress: prepared.intent.to,
    privKeyScalarHex: context.senderPrivKeyScalarHex,
    depositorEphemeralKey: serializeEphemeralKeyString({
      xHex: context.ephemeral.xHex,
      yHex: context.ephemeral.yHex,
    }),
    withdrawAmountStroops: prepared.intent.amount,
    changePrivateAddressStpl1: feeFields.changePrivateAddressStpl1,
    tokenAddress: context.tokenAddress,
    ...(feeFields.feeOutput ? { feeOutput: feeFields.feeOutput } : {}),
  });
  enrichWithdrawOutputRecords(prepared, proof);
  return buildWithdrawFinalizeArtifacts(proof, context, environment);
}

function dualWithdrawEphemeralKeys(input: {
  context: Awaited<ReturnType<typeof buildSpendProofContextAtExecute>>;
  secondary: Awaited<ReturnType<typeof readCoinEphemeralForRecord>>;
}) {
  return {
    depositorEphemeralAKey: serializeEphemeralKeyString({
      xHex: input.context.ephemeral.xHex,
      yHex: input.context.ephemeral.yHex,
    }),
    depositorEphemeralBKey: serializeEphemeralKeyString({
      xHex: input.secondary.ephemeral.xHex,
      yHex: input.secondary.ephemeral.yHex,
    }),
  };
}

async function finalizeDualWithdrawAtExecute(
  prepared: StellarPreparedOperation,
  environment: StellarTransactEnvironment,
  poolService: PrivacyPoolService,
  withdrawFrom: string,
) {
  const [, secondaryRecord] = prepared.consumedRecords;
  if (!secondaryRecord) {
    throw new Error('Dual withdraw execution requires two private input records.');
  }
  const context = await buildSpendProofContextAtExecute({
    prepared,
    environment,
    recipientPrivateAddressStpl1: withdrawFrom,
  });
  const secondary = await readCoinEphemeralForRecord({
    record: secondaryRecord,
    environment,
    walletPublicKey: context.walletPublicKey,
    commitments: context.commitments,
  });
  const feeFields = await withdrawFeeProofFields({
    prepared,
    environment,
    tokenAddress: context.tokenAddress,
    available: BigInt(context.coin.value) + BigInt(secondary.coin.value),
    withdrawFrom,
  });
  const proof = await poolService.prepareWithdrawTransactProofDual({
    coinA: context.coin,
    coinB: secondary.coin,
    state: context.merkleState,
    destinationStellarAddress: prepared.intent.to,
    privKeyScalarHex: context.senderPrivKeyScalarHex,
    ...dualWithdrawEphemeralKeys({ context, secondary }),
    withdrawAmountStroops: prepared.intent.amount,
    changePrivateAddressStpl1: feeFields.changePrivateAddressStpl1,
    tokenAddress: context.tokenAddress,
    ...(feeFields.feeOutput ? { feeOutput: feeFields.feeOutput } : {}),
  });
  enrichWithdrawOutputRecords(prepared, proof);
  return buildWithdrawFinalizeArtifacts(proof, context, environment);
}

async function finalizeWithdrawAtExecute(
  prepared: StellarPreparedOperation,
  environment: StellarTransactEnvironment,
  poolService: PrivacyPoolService,
) {
  if (prepared.kind !== 'withdraw') {
    throw new Error('Withdraw finalize requires a withdraw operation.');
  }
  const withdrawIntent = prepared.intent as WithdrawIntent<
    StellarAddress,
    StellarAssetId,
    bigint
  >;
  const withdrawFrom = withdrawIntent.from;
  const recordCount = prepared.consumedRecords.length;
  if (recordCount === 1) {
    return finalizeSingleWithdrawAtExecute(
      prepared,
      environment,
      poolService,
      withdrawFrom,
    );
  }
  if (recordCount === 2) {
    return finalizeDualWithdrawAtExecute(
      prepared,
      environment,
      poolService,
      withdrawFrom,
    );
  }
  throw new Error('Confidential withdraw execution supports at most two input notes.');
}

export async function finalizeSpendOperationAtExecute(
  prepared: StellarPreparedOperation,
  environment: StellarTransactEnvironment,
  poolService: PrivacyPoolService,
): Promise<StellarPreparedOperation> {
  if (prepared.kind !== 'transfer' && prepared.kind !== 'withdraw') {
    return prepared;
  }
  if (prepared.transactArtifacts?.proofHex) {
    return prepared;
  }
  const artifacts =
    prepared.kind === 'transfer'
      ? await finalizeTransferAtExecute(prepared, environment)
      : await finalizeWithdrawAtExecute(prepared, environment, poolService);
  return {
    ...prepared,
    transactArtifacts: {
      ...prepared.transactArtifacts,
      ...artifacts,
    },
  };
}
