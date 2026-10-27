import { measureStage } from '@arcanetech/privacy-sdk-core';
import { readPoolClientFactory } from '../../contracts/contract-context.js';
import { requestKytPassageForPoolInteraction } from '../kyt/passage-inspect.js';
import type { KytApplicationIdHints } from '../pool/proof-types.js';
import { submitPoolTransact } from './pool-transact.js';
import { transactNonceFromArtifacts } from '../environment/zk-config-nonce.js';
import type { StellarTransactEnvironment } from '../environment/types.js';

export interface SubmitSorobanConfidentialTransferInput {
  contractId: string;
  walletPublicKey: string;
  proofHex: string;
  publicHex: string;
  ciphertextHex?: string;
  outputNoteEphemeralScalars?: string[];
  applicationIdsPlaintext?: KytApplicationIdHints;
  zkConfigNonce?: bigint;
  networkPassphrase: string;
  sorobanRpcUrl: string;
  transactEnvironment: StellarTransactEnvironment;
}

export async function submitSorobanConfidentialTransfer(
  input: SubmitSorobanConfidentialTransferInput,
): Promise<string> {
  const poolClient = readPoolClientFactory(input.transactEnvironment)({
    contractId: input.contractId,
    walletPublicKey: input.walletPublicKey,
    networkPassphrase: input.networkPassphrase,
    sorobanRpcUrl: input.sorobanRpcUrl,
  });
  const nonce = transactNonceFromArtifacts(
    input.zkConfigNonce === undefined
      ? undefined
      : { zkConfigNonce: input.zkConfigNonce },
    input.transactEnvironment,
  );
  const approval = await measureStage('kyt', () => requestTransferKytPassage(input));
  return measureStage('chain', () =>
    submitPoolTransact({
      contractClient: poolClient,
      contractId: input.contractId,
      from: input.walletPublicKey,
      nonce,
      proofHex: input.proofHex,
      publicHex: input.publicHex,
      ...(input.ciphertextHex ? { ciphertextHex: input.ciphertextHex } : {}),
      approval,
      networkPassphrase: input.networkPassphrase,
      sorobanRpcUrl: input.sorobanRpcUrl,
      transactEnvironment: input.transactEnvironment,
    }),
  );
}

function requestTransferKytPassage(input: SubmitSorobanConfidentialTransferInput) {
  return requestKytPassageForPoolInteraction({
    owner: input.walletPublicKey,
    poolContract: input.contractId,
    proofHex: input.proofHex,
    publicHex: input.publicHex,
    ...(input.ciphertextHex ? { ciphertextHex: input.ciphertextHex } : {}),
    ...(input.outputNoteEphemeralScalars
      ? { outputNoteEphemeralScalars: input.outputNoteEphemeralScalars }
      : {}),
    ...(input.applicationIdsPlaintext
      ? { applicationIdsPlaintext: input.applicationIdsPlaintext }
      : {}),
    ...(input.zkConfigNonce === undefined
      ? {}
      : { zkConfigNonce: input.zkConfigNonce }),
    networkPassphrase: input.networkPassphrase,
    sorobanRpcUrl: input.sorobanRpcUrl,
    transactEnvironment: input.transactEnvironment,
  });
}
