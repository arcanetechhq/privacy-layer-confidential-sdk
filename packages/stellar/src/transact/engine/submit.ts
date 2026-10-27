import { measureStage } from '@arcanetech/privacy-sdk-core';
import type { StellarPreparedOperation } from '../../types.js';
import { readPoolClientFactory } from '../../contracts/contract-context.js';
import type { StellarTransactEnvironment } from '../environment/types.js';
import type { PrivacyPoolService } from '../pool/service.js';
import { finalizeSpendOperationAtExecute } from './execute.js';
import { submitSorobanConfidentialTransfer } from '../submit/soroban-confidential-transfer.js';
import { requestKytPassageForPoolInteraction } from '../kyt/passage-inspect.js';
import { submitPoolTransact } from '../submit/pool-transact.js';
import { transactNonceFromArtifacts } from '../environment/zk-config-nonce.js';

function optionalInspectCiphertext(
  artifacts: NonNullable<StellarPreparedOperation['transactArtifacts']>,
): Pick<
  NonNullable<StellarPreparedOperation['transactArtifacts']>,
  'ciphertextHex' | 'outputNoteEphemeralScalars' | 'applicationIdsPlaintext'
> {
  return {
    ...(artifacts.ciphertextHex ? { ciphertextHex: artifacts.ciphertextHex } : {}),
    ...(artifacts.outputNoteEphemeralScalars
      ? { outputNoteEphemeralScalars: artifacts.outputNoteEphemeralScalars }
      : {}),
    ...(artifacts.applicationIdsPlaintext
      ? { applicationIdsPlaintext: artifacts.applicationIdsPlaintext }
      : {}),
  };
}

async function submitPreparedDeposit(
  prepared: StellarPreparedOperation,
  environment: StellarTransactEnvironment,
): Promise<string> {
  const artifacts = prepared.transactArtifacts;
  const outputRecord = prepared.outputRecords[0];
  if (
    !artifacts?.proofHex ||
    !artifacts.publicHex ||
    !artifacts.walletPublicKey ||
    !artifacts.depositScalarHex ||
    !outputRecord?.coinNote
  ) {
    throw new Error('Prepared deposit is missing transact artifacts.');
  }
  return submitGuardedDeposit({
    environment,
    artifacts,
    proofHex: artifacts.proofHex,
    publicHex: artifacts.publicHex,
    walletPublicKey: artifacts.walletPublicKey,
  });
}

async function submitGuardedDeposit(input: {
  environment: StellarTransactEnvironment;
  artifacts: NonNullable<StellarPreparedOperation['transactArtifacts']>;
  proofHex: string;
  publicHex: string;
  walletPublicKey: string;
}): Promise<string> {
  const poolClient = readPoolClientFactory(input.environment)({
    contractId: input.environment.network.poolContract,
    walletPublicKey: input.walletPublicKey,
    networkPassphrase: input.environment.network.networkPassphrase,
    sorobanRpcUrl: input.environment.network.rpcUrl,
  });
  const approval = await measureStage('kyt', () => requestDepositKytPassage(input));
  return measureStage('chain', () =>
    submitPoolTransact({
      contractClient: poolClient,
      contractId: input.environment.network.poolContract,
      from: input.walletPublicKey,
      nonce: transactNonceFromArtifacts(input.artifacts, input.environment),
      proofHex: input.proofHex,
      publicHex: input.publicHex,
      ...(input.artifacts.ciphertextHex
        ? { ciphertextHex: input.artifacts.ciphertextHex }
        : {}),
      approval,
      networkPassphrase: input.environment.network.networkPassphrase,
      sorobanRpcUrl: input.environment.network.rpcUrl,
      transactEnvironment: input.environment,
    }),
  );
}

function requestDepositKytPassage(input: {
  environment: StellarTransactEnvironment;
  artifacts: NonNullable<StellarPreparedOperation['transactArtifacts']>;
  proofHex: string;
  publicHex: string;
  walletPublicKey: string;
}) {
  return requestKytPassageForPoolInteraction({
    owner: input.walletPublicKey,
    poolContract: input.environment.network.poolContract,
    proofHex: input.proofHex,
    publicHex: input.publicHex,
    ...optionalInspectCiphertext(input.artifacts),
    ...(input.artifacts.zkConfigNonce === undefined
      ? {}
      : { zkConfigNonce: input.artifacts.zkConfigNonce }),
    networkPassphrase: input.environment.network.networkPassphrase,
    sorobanRpcUrl: input.environment.network.rpcUrl,
    transactEnvironment: input.environment,
  });
}

async function submitPreparedPoolTransact(
  prepared: StellarPreparedOperation,
  environment: StellarTransactEnvironment,
): Promise<string> {
  const artifacts = prepared.transactArtifacts;
  if (!artifacts?.proofHex || !artifacts.publicHex || !artifacts.walletPublicKey) {
    throw new Error('Prepared operation is missing transact artifacts.');
  }
  return submitSorobanConfidentialTransfer({
    contractId: environment.network.poolContract,
    walletPublicKey: artifacts.walletPublicKey,
    proofHex: artifacts.proofHex,
    publicHex: artifacts.publicHex,
    ...optionalInspectCiphertext(artifacts),
    ...(artifacts.zkConfigNonce === undefined
      ? {}
      : { zkConfigNonce: artifacts.zkConfigNonce }),
    networkPassphrase: environment.network.networkPassphrase,
    sorobanRpcUrl: environment.network.rpcUrl,
    transactEnvironment: environment,
  });
}

export async function submitPreparedOperation(
  prepared: StellarPreparedOperation,
  environment: StellarTransactEnvironment,
  poolService: PrivacyPoolService,
): Promise<string> {
  const finalized =
    prepared.kind === 'deposit'
      ? prepared
      : await finalizeSpendOperationAtExecute(prepared, environment, poolService);
  if (finalized.kind === 'deposit') {
    return submitPreparedDeposit(finalized, environment);
  }
  return submitPreparedPoolTransact(finalized, environment);
}
