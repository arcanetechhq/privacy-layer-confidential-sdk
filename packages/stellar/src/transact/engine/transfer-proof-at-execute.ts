import type { StellarPreparedOperation } from '../../types.js';
import type {
  StellarTransactEnvironment,
  TransferEscrowClaimantLimbs,
  TransferEscrowSend,
} from '../environment/types.js';
import {
  prepareConfidentialTransferProof,
  prepareConfidentialTransferProofDual,
} from '../proofs/confidential/single.js';
import {
  buildSpendProofContextAtExecute,
  readCoinEphemeralForRecord,
} from './spend-proof-context.js';
import { serializeEphemeralKeyString } from '../encoding/ephemeral-key.js';
import { readTransferFromPrivateAddress } from '../transfer-source/index.js';
import { quoteFeeOutputForPrepared } from '../fees/quote-fee-output-for-prepared.js';

function readChangeRecipient(
  input: { prepared: StellarPreparedOperation },
  changeStroops: bigint,
): string | undefined {
  if (changeStroops <= 0n || input.prepared.kind !== 'transfer') {
    return undefined;
  }
  const from = input.prepared.intent.from;
  return readTransferFromPrivateAddress(from);
}

function proofEscrowFields(input: {
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

async function buildSingleTransferProofAtExecute(input: {
  prepared: StellarPreparedOperation;
  environment: StellarTransactEnvironment;
  recipientPrivateAddressStpl1: string;
  escrowSend?: TransferEscrowSend;
  escrowClaimantLimbs?: TransferEscrowClaimantLimbs;
}) {
  const context = await buildSpendProofContextAtExecute(input);
  const feeOutput = await quoteFeeOutputForPrepared({
    prepared: input.prepared,
    environment: input.environment,
    tokenAddress: context.tokenAddress,
  });
  const changeStroops =
    BigInt(context.coin.value) -
    input.prepared.intent.amount -
    (feeOutput?.requiredFee ?? 0n);
  const proof = await prepareConfidentialTransferProof({
    coin: context.coin,
    state: context.merkleState,
    senderPrivKeyScalarHex: context.senderPrivKeyScalarHex,
    depositorEphemeralKey: serializeEphemeralKeyString({
      xHex: context.ephemeral.xHex,
      yHex: context.ephemeral.yHex,
    }),
    transferStroops: input.prepared.intent.amount,
    recipientPrivateAddressStpl1: context.recipientPrivateAddressStpl1,
    selfPrivateAddressStpl1ForChange: readChangeRecipient(input, changeStroops),
    tokenAddress: context.tokenAddress,
    ...proofEscrowFields(input),
    ...(feeOutput ? { feeOutput } : {}),
  });
  return { context, proof };
}

async function buildDualTransferProofAtExecute(input: {
  prepared: StellarPreparedOperation;
  environment: StellarTransactEnvironment;
  recipientPrivateAddressStpl1: string;
  escrowSend?: TransferEscrowSend;
  escrowClaimantLimbs?: TransferEscrowClaimantLimbs;
}) {
  const [primaryRecord, secondaryRecord] = input.prepared.consumedRecords;
  if (!primaryRecord || !secondaryRecord) {
    throw new Error('Dual transfer execution requires two private input records.');
  }
  const context = await buildSpendProofContextAtExecute(input);
  const secondary = await readCoinEphemeralForRecord({
    record: secondaryRecord,
    environment: input.environment,
    walletPublicKey: context.walletPublicKey,
    commitments: context.commitments,
  });
  const totalNotes = BigInt(context.coin.value) + BigInt(secondary.coin.value);
  const feeOutput = await quoteFeeOutputForPrepared({
    prepared: input.prepared,
    environment: input.environment,
    tokenAddress: context.tokenAddress,
  });
  const changeStroops =
    totalNotes - input.prepared.intent.amount - (feeOutput?.requiredFee ?? 0n);
  const proof = await prepareConfidentialTransferProofDual({
    coinA: context.coin,
    coinB: secondary.coin,
    state: context.merkleState,
    senderPrivKeyScalarHex: context.senderPrivKeyScalarHex,
    ephemeralAKey: serializeEphemeralKeyString({
      xHex: context.ephemeral.xHex,
      yHex: context.ephemeral.yHex,
    }),
    ephemeralBKey: serializeEphemeralKeyString({
      xHex: secondary.ephemeral.xHex,
      yHex: secondary.ephemeral.yHex,
    }),
    transferStroops: input.prepared.intent.amount,
    recipientPrivateAddressStpl1: context.recipientPrivateAddressStpl1,
    selfPrivateAddressStpl1ForChange: readChangeRecipient(input, changeStroops),
    tokenAddress: context.tokenAddress,
    ...proofEscrowFields(input),
    ...(feeOutput ? { feeOutput } : {}),
  });
  return { context, proof };
}

export async function buildTransferProofAtExecute(input: {
  prepared: StellarPreparedOperation;
  environment: StellarTransactEnvironment;
  recipientPrivateAddressStpl1: string;
  escrowSend?: TransferEscrowSend;
  escrowClaimantLimbs?: TransferEscrowClaimantLimbs;
}) {
  const recordCount = input.prepared.consumedRecords.length;
  if (recordCount === 1) {
    return buildSingleTransferProofAtExecute(input);
  }
  if (recordCount === 2) {
    return buildDualTransferProofAtExecute(input);
  }
  throw new Error('Confidential transfer execution supports at most two input notes.');
}
