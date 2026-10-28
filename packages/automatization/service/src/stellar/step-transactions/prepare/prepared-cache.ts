import type { ProofRequest, TransactInvocation } from '../../../ports/index.js';
import type { PreparedStep } from './prepare.js';

export interface CachedStep {
  readonly key: string;
  readonly invocationKey: string;
  readonly prepared: PreparedStep;
}

export function invocationOf(request: ProofRequest): TransactInvocation {
  return {
    root: request.root,
    pinnedOutputCommitments: request.step.pinnedOutputs.map((note) => note.commitment),
  };
}

export function invocationKey(invocation: TransactInvocation): string {
  return `${invocation.root}|${invocation.pinnedOutputCommitments.join(',')}`;
}

export function proofKey(request: ProofRequest, from: string): string {
  return [
    invocationKey(invocationOf(request)),
    request.feeNote.amount,
    request.feeNote.collector,
    request.unspentNote?.scalar ?? '',
    request.publicDeposit,
    request.publicWithdrawal,
    request.recipient,
    from,
  ].join('|');
}

export function createPreparedCache() {
  const byKey = new Map<string, CachedStep>();
  const byInvocation = new Map<string, CachedStep>();
  return {
    byProofKey: (key: string) => byKey.get(key),
    byInvocation: (invocation: TransactInvocation) =>
      byInvocation.get(invocationKey(invocation)),
    remember(entry: CachedStep): void {
      byKey.set(entry.key, entry);
      byInvocation.set(entry.invocationKey, entry);
    },
    drop(entry: CachedStep): void {
      byKey.delete(entry.key);
      byInvocation.delete(entry.invocationKey);
    },
    clear(): void {
      byKey.clear();
      byInvocation.clear();
    },
  };
}
