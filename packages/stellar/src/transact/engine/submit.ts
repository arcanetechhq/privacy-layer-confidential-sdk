import type { StellarPreparedOperation } from '../../types.js';
import { readPoolClientFactory } from '../../contracts/contract-context.js';
import type { StellarTransactEnvironment } from '../environment/types.js';
import type { PrivacyPoolService } from '../pool/service.js';
import { finalizeSpendOperationAtExecute } from './execute.js';
import { submitSorobanConfidentialTransfer } from '../submit/soroban-confidential-transfer.js';
import { requestKytPassageForPoolInteraction } from '../kyt/passage-inspect.js';
import { submitPoolTransact } from '../submit/pool-transact.js';
import { submitPublicOutput } from '../submit/public-output.js';
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
  const poolClient = readPoolClientFactory(environment)({
    contractId: environment.network.poolContract,
    walletPublicKey: artifacts.walletPublicKey,
    networkPassphrase: environment.network.networkPassphrase,
    sorobanRpcUrl: environment.network.rpcUrl,
  });
  const nonce = transactNonceFromArtifacts(artifacts, environment);
  const approval = await requestKytPassageForPoolInteraction({
    owner: artifacts.walletPublicKey,
    poolContract: environment.network.poolContract,
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
  return submitPoolTransact({
    contractClient: poolClient,
    contractId: environment.network.poolContract,
    from: artifacts.walletPublicKey,
    nonce,
    proofHex: artifacts.proofHex,
    publicHex: artifacts.publicHex,
    ...(artifacts.ciphertextHex ? { ciphertextHex: artifacts.ciphertextHex } : {}),
    approval,
    networkPassphrase: environment.network.networkPassphrase,
    sorobanRpcUrl: environment.network.rpcUrl,
    transactEnvironment: environment,
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

async function submitPreparedPublicOutput(
  prepared: StellarPreparedOperation,
  environment: StellarTransactEnvironment,
): Promise<string> {
  const output = prepared.publicOutput;
  if (!output) {
    throw new Error('Prepared public withdraw is missing its note opening.');
  }
  const poolClient = readPoolClientFactory(environment)({
    contractId: environment.network.poolContract,
    walletPublicKey: output.to,
    networkPassphrase: environment.network.networkPassphrase,
    sorobanRpcUrl: environment.network.rpcUrl,
  });
  return submitPublicOutput({
    contractClient: poolClient,
    note: output.note,
    leafIndex: output.leafIndex,
    to: output.to,
  });
}

export async function submitPreparedOperation(
  prepared: StellarPreparedOperation,
  environment: StellarTransactEnvironment,
  poolService: PrivacyPoolService,
): Promise<string> {
  if (prepared.kind === 'publicWithdraw') {
    return submitPreparedPublicOutput(prepared, environment);
  }
  const finalized =
    prepared.kind === 'deposit'
      ? prepared
      : await finalizeSpendOperationAtExecute(prepared, environment, poolService);
  if (finalized.kind === 'deposit') {
    return submitPreparedDeposit(finalized, environment);
  }
  return submitPreparedPoolTransact(finalized, environment);
}
