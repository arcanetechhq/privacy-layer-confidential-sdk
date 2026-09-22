import type { StellarPreparedOperation, StellarPrivateRecord } from '../../types.js';
import type { StellarTransactEnvironment } from '../environment/types.js';
import { readLeafEphemeralHex } from '../merkle/fetch-contract.js';
import {
  findCommitmentLeafIndex,
  requireCoinNoteFromRecord,
} from '../private-address/record-coin.js';
import {
  ensureSenderPrivKeyScalarHex,
  loadMerkleState,
  resolveTokenContractId,
} from './prepare/shared.js';
import {
  isEscrowSweepSpend,
  requireEscrowSpendScalarHex,
} from '../escrow/require-escrow-spend-scalar.js';
import { readTransferFromPrivateAddress } from '../transfer-source/index.js';

async function resolveSenderPrivKeyScalarHex(input: {
  prepared: StellarPreparedOperation;
  environment: StellarTransactEnvironment;
  walletPublicKey: string;
}): Promise<string> {
  if (isEscrowSweepSpend(input.prepared.transactArtifacts)) {
    return requireEscrowSpendScalarHex(input.prepared.transactArtifacts);
  }
  if (input.prepared.kind !== 'transfer' && input.prepared.kind !== 'withdraw') {
    throw new Error('Spend execution requires a transfer or withdraw intent.');
  }
  return ensureSenderPrivKeyScalarHex(
    input.environment,
    readTransferFromPrivateAddress(input.prepared.intent.from),
    input.walletPublicKey,
  );
}

export async function buildSpendProofContextAtExecute(input: {
  prepared: StellarPreparedOperation;
  environment: StellarTransactEnvironment;
  recipientPrivateAddressStpl1: string;
}) {
  const [primaryRecord] = input.prepared.consumedRecords;
  if (!primaryRecord) {
    throw new Error('Spend execution requires at least one private record.');
  }
  const walletPublicKey = primaryRecord.owner.trim();
  if (!walletPublicKey) {
    throw new Error('Spend execution record owner is missing.');
  }
  const senderPrivKeyScalarHex = await resolveSenderPrivKeyScalarHex({
    prepared: input.prepared,
    environment: input.environment,
    walletPublicKey,
  });
  const tokenAddress = await resolveTokenContractId(
    input.environment,
    input.prepared.intent.asset,
  );
  const coin = requireCoinNoteFromRecord(primaryRecord);
  const merkleState = await loadMerkleState(input.environment, walletPublicKey);
  const commitments = merkleState.commitments;
  const leafIndex = findCommitmentLeafIndex(commitments, coin.commitment);
  if (leafIndex < 0) {
    throw new Error('Coin commitment not found in on-chain Merkle state.');
  }
  const ephemeral = await readLeafEphemeralHex({
    poolContractId: input.environment.network.poolContract,
    walletPublicKey,
    leafIndex,
    transactEnvironment: input.environment,
    ...(input.environment.leafEphemeral
      ? { leafEphemeral: input.environment.leafEphemeral }
      : {}),
  });
  return {
    walletPublicKey,
    tokenAddress,
    coin,
    commitments,
    merkleState,
    ephemeral,
    senderPrivKeyScalarHex,
    recipientPrivateAddressStpl1: input.recipientPrivateAddressStpl1,
  };
}

export async function readCoinEphemeralForRecord(input: {
  record: StellarPrivateRecord;
  environment: StellarTransactEnvironment;
  walletPublicKey: string;
  commitments: string[];
}) {
  const coin = requireCoinNoteFromRecord(input.record);
  const leafIndex = findCommitmentLeafIndex(input.commitments, coin.commitment);
  if (leafIndex < 0) {
    throw new Error('Coin commitment not found in on-chain Merkle state.');
  }
  const ephemeral = await readLeafEphemeralHex({
    poolContractId: input.environment.network.poolContract,
    walletPublicKey: input.walletPublicKey,
    leafIndex,
    transactEnvironment: input.environment,
    ...(input.environment.leafEphemeral
      ? { leafEphemeral: input.environment.leafEphemeral }
      : {}),
  });
  return { coin, ephemeral };
}
