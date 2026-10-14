import { runTtlPreflight } from './ttl-preflight.js';
import type { PoolTransactClient } from '../pool/types.js';
import { publicOutputNoteBuffers } from '../public-withdraw/submission.js';
import type { StellarPublicOutputNoteFields } from '../public-withdraw/types.js';

export async function submitPublicOutput(parameters: {
  contractClient: PoolTransactClient;
  note: StellarPublicOutputNoteFields;
  leafIndex: number;
  to: string;
}): Promise<string> {
  const assembledTransaction = await parameters.contractClient.public_output({
    note: publicOutputNoteBuffers(parameters.note),
    leaf_index: parameters.leafIndex,
    to: parameters.to,
  });
  await runTtlPreflight(assembledTransaction);
  const sentTransaction = await assembledTransaction.signAndSend();
  const transactionHash = sentTransaction.sendTransactionResponse?.hash ?? '';
  if (!transactionHash) {
    throw new Error('Transaction failed');
  }
  return transactionHash;
}
