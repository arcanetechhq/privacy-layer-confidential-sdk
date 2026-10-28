import { expect, it } from 'vitest';
import type {
  PinnedNotePresence,
  Plan,
  Step,
} from '@arcanetech/privacy-sdk-automatization-plan';
import {
  compose,
  type DepositAuthorization,
  type FeeNote,
  type FeeQuote,
  type FeeQuoteRequest,
  type NoteDeriver,
  createMemoryPlanStore,
} from '../../src/index.js';

export const SERVICE_ACCOUNT = 'service-account';
export const SERVICE_SCALAR = 'service-scalar-secret';
export const CURRENT_ROOT = 'current-root';
export const SOROBAN_AUTHORIZATION = 'depositor-soroban-authorization';
export const INITIAL_TRANSACTION = 'tx-initial-deposit';
export const TRANSFER_TRANSACTION = 'tx-bob-transfer';
export const notes: NoteDeriver = {
  derive(plaintext) {
    return {
      commitment: `commitment-${plaintext.amount}-${plaintext.accumulator}`,
      nullifierHash: `nullifier-${plaintext.amount}-${plaintext.accumulator}`,
    };
  },
};
export function composeExample(): Plan {
  return compose(
    {
      recipients: [
        { account: 'bob-account', amount: 30n },
        { account: 'carol-account', amount: 20n },
        { account: 'dave-account', amount: 10n },
      ],
      freeTokenFloor: 2n,
      standardInterval: 7n,
    },
    notes,
  );
}
export function depositStep(plan: Plan) {
  const row = plan.rows[0];
  if (row?.kind !== 'deposit') {
    throw new Error('expected an Initial Deposit');
  }
  return row.step;
}
export function payoutAt(plan: Plan, index: number) {
  const row = plan.rows[index];
  if (row?.kind !== 'payout') {
    throw new Error(`expected a Payout at ${index}`);
  }
  return row;
}
export function transferStep(plan: Plan): Step {
  return withdrawalStep(plan);
}
export function withdrawalStep(plan: Plan) {
  return payoutAt(plan, 1).withdrawal;
}
export function depositAt(plan: Plan, index: number) {
  const row = plan.rows[index];
  if (row?.kind !== 'deposit') {
    throw new Error(`expected a Deposit at ${index}`);
  }
  return row;
}
export function stepsOf(plan: Plan): Step[] {
  const steps: Step[] = [];
  for (const row of plan.rows) {
    if (row.kind === 'deposit') {
      steps.push(row.step);
      continue;
    }
    if (row.transfer !== undefined) {
      steps.push(row.transfer);
    }
    steps.push(row.withdrawal);
  }
  return steps;
}
export function presenceForFirst(plan: Plan, count: number): PinnedNotePresence {
  const steps = stepsOf(plan).slice(0, count);
  return {
    consumedNullifierHashes: steps.flatMap((step) =>
      step.pinnedInputs.map((note) => note.nullifierHash),
    ),
    outputCommitmentsInPoolTree: steps.flatMap((step) =>
      step.pinnedOutputs.map((note) => note.commitment),
    ),
  };
}
export function authorizationForStep(
  step: Step,
  root: string,
  sorobanAuthorization: string,
): DepositAuthorization {
  return {
    invocation: {
      root,
      pinnedOutputCommitments: step.pinnedOutputs.map((note) => note.commitment),
    },
    sorobanAuthorization,
  };
}
export function authorizationFor(plan: Plan): DepositAuthorization {
  return authorizationForStep(depositStep(plan), CURRENT_ROOT, SOROBAN_AUTHORIZATION);
}
export function executedInitialDeposit(plan: Plan): PinnedNotePresence {
  return {
    consumedNullifierHashes: [],
    outputCommitmentsInPoolTree: depositStep(plan).pinnedOutputs.map(
      (note) => note.commitment,
    ),
  };
}
export function harness() {
  let now = 0n;
  let presence: PinnedNotePresence = {
    consumedNullifierHashes: [],
    outputCommitmentsInPoolTree: [],
  };
  const quotes: FeeQuoteRequest[] = [];
  const feeNotes: FeeNote[] = [];
  const order: string[] = [];
  const submittedTransactionIds: string[] = [];
  const submittedAuthorizations: Array<string | undefined> = [];
  const envelopeSigners: string[] = [];
  const proofRoots: string[] = [];
  let scalars = ['unspent-scalar-initial', 'unspent-scalar-transfer'];
  let scalarIndex = 0;
  let quote: FeeQuote = { amount: 1n, collector: 'fee-collector' };
  let inspectDecision: 'accept' | 'refuse' = 'accept';
  let acceptSubmit = true;
  let root = CURRENT_ROOT;
  const transactionIds = [
    INITIAL_TRANSACTION,
    TRANSFER_TRANSACTION,
    'tx-bob-withdrawal',
    'tx-later-deposit',
  ];
  let transactionIndex = 0;

  const dependencies = {
    serviceAccount: SERVICE_ACCOUNT,
    serviceScalar: SERVICE_SCALAR,
    clock: { now: async () => now },
    currentRoot: { current: async () => root },
    feeQuotes: {
      async quote(request: FeeQuoteRequest) {
        order.push('quote');
        quotes.push(request);
        return quote;
      },
    },
    proofs: {
      async prove(input: {
        root: string;
        feeNote: FeeNote;
        step: { pinnedOutputs: readonly { commitment: string }[] };
      }) {
        order.push('proof');
        feeNotes.push(input.feeNote);
        proofRoots.push(input.root);
        return {
          root: input.root,
          pinnedOutputCommitments: input.step.pinnedOutputs.map(
            (note) => note.commitment,
          ),
        };
      },
    },
    inspection: {
      async inspect() {
        order.push('inspect');
        return inspectDecision;
      },
    },
    pool: {
      async submit(
        transaction: { envelopeSigner: string },
        authorization?: DepositAuthorization,
      ) {
        order.push('submit');
        envelopeSigners.push(transaction.envelopeSigner);
        const transactionId =
          transactionIds[transactionIndex] ?? `tx-${transactionIndex}`;
        transactionIndex += 1;
        submittedTransactionIds.push(transactionId);
        submittedAuthorizations.push(authorization?.sorobanAuthorization);
        if (!acceptSubmit) {
          return { ok: false as const };
        }
        return { ok: true as const, transactionId };
      },
    },
    presence: { report: async () => presence },
    freshScalars: {
      async next() {
        const scalar = scalars[scalarIndex] ?? `unspent-scalar-${scalarIndex}`;
        scalarIndex += 1;
        return scalar;
      },
    },
    noteOwnership: { isOwnedByServiceScalar: async () => true },
    store: createMemoryPlanStore(),
  };

  return {
    dependencies,
    quotes,
    feeNotes,
    order,
    proofRoots,
    submittedTransactionIds,
    submittedAuthorizations,
    envelopeSigners,
    setNow(value: bigint) {
      now = value;
    },
    setPresence(value: PinnedNotePresence) {
      presence = value;
    },
    setQuote(next: FeeQuote) {
      quote = next;
    },
    setInspect(next: 'accept' | 'refuse') {
      inspectDecision = next;
    },
    setSubmitOk(next: boolean) {
      acceptSubmit = next;
    },
    setRoot(next: string) {
      root = next;
    },
    setScalars(next: string[]) {
      scalars = next;
      scalarIndex = 0;
    },
  };
}
export function planText(plan: Plan): string {
  return JSON.stringify(plan, (_key, value: unknown) =>
    typeof value === 'bigint' ? String(value) : value,
  );
}

it('opens the harness on an empty Plan store', async () => {
  expect(await harness().dependencies.store.ids()).toEqual([]);
});
