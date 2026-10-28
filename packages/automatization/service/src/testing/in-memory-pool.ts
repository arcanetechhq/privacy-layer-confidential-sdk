import {
  stepsInRow,
  type PinnedNotePresence,
  type Step,
} from '@arcanetech/privacy-sdk-automatization-plan';
import type {
  CurrentRoot,
  DepositSigning,
  FeeQuote,
  FeeQuotes,
  FreshScalars,
  Inspection,
  NoteDeriver,
  PlanStore,
  PoolSubmission,
  Presence,
  Proofs,
  TransactInvocation,
} from '../ports/index.js';

export interface InMemoryPoolOptions {
  readonly poolId?: string;
  readonly feeQuote?: FeeQuote;
}

export interface InMemoryPool {
  readonly currentRoot: CurrentRoot;
  readonly presence: Presence;
  readonly feeQuotes: FeeQuotes;
  readonly freshScalars: FreshScalars;
  readonly proofs: Proofs;
  readonly inspection: Inspection;
  readonly pool: PoolSubmission;
  readonly depositSigning: DepositSigning;
  clear(): void;
}

interface Ledger {
  readonly consumed: Set<string>;
  readonly commitments: Set<string>;
  submitted: number;
}

export const inMemoryNoteDeriver: NoteDeriver = {
  derive(plaintext) {
    const body = `${plaintext.amount.toString()}:${plaintext.accumulator}`;
    return { commitment: `commitment:${body}`, nullifierHash: `nullifier:${body}` };
  },
};

function pinsSameOutputs(step: Step, invocation: TransactInvocation): boolean {
  const pinned = invocation.pinnedOutputCommitments;
  return (
    step.pinnedOutputs.length === pinned.length &&
    step.pinnedOutputs.every((note, index) => note.commitment === pinned[index])
  );
}

function alreadyRecorded(step: Step, ledger: Ledger): boolean {
  return (
    step.pinnedInputs.every((note) => ledger.consumed.has(note.nullifierHash)) &&
    step.pinnedOutputs.every((note) => ledger.commitments.has(note.commitment))
  );
}

async function matchingStep(
  store: Pick<PlanStore, 'ids' | 'read'>,
  invocation: TransactInvocation,
  ledger: Ledger,
): Promise<Step | undefined> {
  for (const id of await store.ids()) {
    const plan = await store.read(id);
    const step = plan.rows
      .flatMap((row) => stepsInRow(row))
      .find(
        (candidate) =>
          pinsSameOutputs(candidate, invocation) && !alreadyRecorded(candidate, ledger),
      );
    if (step !== undefined) {
      return step;
    }
  }
  return undefined;
}

async function record(
  store: Pick<PlanStore, 'ids' | 'read'>,
  invocation: TransactInvocation,
  ledger: Ledger,
): Promise<void> {
  const step = await matchingStep(store, invocation, ledger);
  for (const note of step?.pinnedInputs ?? []) {
    ledger.consumed.add(note.nullifierHash);
  }
  for (const commitment of invocation.pinnedOutputCommitments) {
    ledger.commitments.add(commitment);
  }
}

function report(ledger: Ledger): PinnedNotePresence {
  return {
    consumedNullifierHashes: [...ledger.consumed],
    outputCommitmentsInPoolTree: [...ledger.commitments],
  };
}

function recordingPool(
  store: Pick<PlanStore, 'ids' | 'read'>,
  ledger: Ledger,
  poolId: string,
): PoolSubmission {
  return {
    async submit(transaction) {
      if (transaction.envelopeSigner.length === 0) {
        return { ok: false };
      }
      await record(store, transaction.invocation, ledger);
      ledger.submitted += 1;
      return { ok: true, transactionId: `tx-${poolId}-${String(ledger.submitted)}` };
    },
  };
}

export function createInMemoryPool(
  store: Pick<PlanStore, 'ids' | 'read'>,
  options: InMemoryPoolOptions = {},
): InMemoryPool {
  const poolId = options.poolId ?? 'in-memory-pool';
  const feeQuote = options.feeQuote ?? {
    amount: 1n,
    collector: 'in-memory-fee-collector',
  };
  const ledger: Ledger = { consumed: new Set(), commitments: new Set(), submitted: 0 };
  let scalars = 0;
  return {
    currentRoot: { current: () => Promise.resolve(`root:${poolId}`) },
    presence: { report: () => Promise.resolve(report(ledger)) },
    feeQuotes: { quote: () => Promise.resolve(feeQuote) },
    freshScalars: {
      next() {
        scalars += 1;
        return Promise.resolve(`unspent-${String(scalars)}`);
      },
    },
    proofs: {
      prove: (request) =>
        Promise.resolve({
          root: request.root,
          pinnedOutputCommitments: request.step.pinnedOutputs.map(
            (note) => note.commitment,
          ),
        }),
    },
    inspection: { inspect: () => Promise.resolve('accept') },
    pool: recordingPool(store, ledger, poolId),
    depositSigning: { authEntries: () => Promise.resolve([]) },
    clear() {
      ledger.consumed.clear();
      ledger.commitments.clear();
      ledger.submitted = 0;
      scalars = 0;
    },
  };
}
