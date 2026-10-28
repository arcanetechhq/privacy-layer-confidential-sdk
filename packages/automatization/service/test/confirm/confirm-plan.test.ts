import type { Deposit, Plan, Step } from '@arcanetech/privacy-sdk-automatization-plan';
import { expect, expectTypeOf, it } from 'vitest';
import {
  AccumulatorMismatchError,
  compose,
  confirm,
  DepositAuthorizationMismatchError,
  insertDeposit,
  PlanNotFoundError,
  read,
  UnownedNoteError,
  createMemoryPlanStore,
  type ConfirmDependencies,
  type MemoryPlanStore,
  type PlanStore,
  type DepositAuthorization,
  type FeeQuoteRequest,
  type NoteDeriver,
  type ServiceTransaction,
} from '../../src/index.js';

type TestConfirmDependencies = ConfirmDependencies & {
  readonly store: MemoryPlanStore;
};

const SERVICE_ACCOUNT = 'service-account';
const SERVICE_SCALAR = 'service-scalar-secret';
const CURRENT_ROOT = 'current-root';
const SOROBAN_AUTHORIZATION = 'depositor-soroban-authorization';
const TRANSACTION_ID = 'tx-initial-deposit';

const notes: NoteDeriver = {
  derive(plaintext) {
    return {
      commitment: `commitment-${plaintext.amount}-${plaintext.accumulator}`,
      nullifierHash: `nullifier-${plaintext.amount}-${plaintext.accumulator}`,
    };
  },
};

function composeExample(): Plan {
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

function depositAt(plan: Plan, index: number): Deposit {
  const row = plan.rows[index];
  if (row?.kind !== 'deposit') {
    throw new Error(`expected a Deposit at ${index}`);
  }
  return row;
}

interface RecordedSubmission {
  readonly transaction: ServiceTransaction;
  readonly authorization: DepositAuthorization;
}

function authorizationFor(plan: Plan): DepositAuthorization {
  return {
    invocation: {
      root: CURRENT_ROOT,
      pinnedOutputCommitments: depositAt(plan, 0).step.pinnedOutputs.map(
        (note) => note.commitment,
      ),
    },
    sorobanAuthorization: SOROBAN_AUTHORIZATION,
  };
}

function confirmingService(): {
  dependencies: TestConfirmDependencies;
  quotes: FeeQuoteRequest[];
  provedSteps: Step[];
  proofRoots: string[];
  submissions: RecordedSubmission[];
  order: string[];
} {
  const quotes: FeeQuoteRequest[] = [];
  const provedSteps: Step[] = [];
  const proofRoots: string[] = [];
  const submissions: RecordedSubmission[] = [];
  const order: string[] = [];
  const dependencies: TestConfirmDependencies = {
    serviceAccount: SERVICE_ACCOUNT,
    serviceScalar: SERVICE_SCALAR,
    currentRoot: { current: async () => CURRENT_ROOT },
    feeQuotes: {
      async quote(request) {
        order.push('quote');
        quotes.push(request);
        return { amount: 1n, collector: 'fee-collector' };
      },
    },
    proofs: {
      async prove(input) {
        order.push('proof');
        provedSteps.push(input.step);
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
        return 'accept' as const;
      },
    },
    pool: {
      async submit(transaction, submittedAuthorization) {
        if (submittedAuthorization === undefined) {
          throw new Error('expected a Deposit authorization');
        }
        order.push('submit');
        submissions.push({ transaction, authorization: submittedAuthorization });
        return { ok: true, transactionId: TRANSACTION_ID };
      },
    },
    noteOwnership: {
      isOwnedByServiceScalar: async () => true,
    },
    clock: { now: async () => 0n },
    freshScalars: { next: async () => 'unspent-scalar' },
    store: createMemoryPlanStore(),
  };
  return { dependencies, quotes, provedSteps, proofRoots, submissions, order };
}

it('quotes the Initial Deposit before its proof and submits that invocation in the service transaction', async () => {
  const plan = composeExample();
  // Initial Deposit 68 = three mode 010 notes 66 + Free tokens 2. A Deposit withdraws 0.
  expect(depositAt(plan, 0).amount).toBe(68n);
  expect(depositAt(plan, 0).step.pinnedOutputs[0]?.plaintext.amount).toBe(32n);
  expect(depositAt(plan, 0).step.freeTokens).toBe(2n);

  const service = confirmingService();
  const authorization = authorizationFor(plan);
  await confirm(plan, authorization, service.dependencies);

  expect(service.order).toEqual(['quote', 'proof', 'inspect', 'submit']);
  expect(service.proofRoots).toEqual([CURRENT_ROOT]);
  expect(service.quotes).toEqual([
    { publicDeposit: 68n, valueMoved: 68n, publicWithdrawal: 0n },
  ]);
  expect(service.submissions).toEqual([
    {
      transaction: {
        envelopeSigner: SERVICE_ACCOUNT,
        invocation: authorization.invocation,
      },
      authorization,
    },
  ]);
  expect(service.submissions[0]?.transaction).not.toHaveProperty(
    'sorobanAuthorization',
  );
});

it('rejects a Deposit authorization that signs an earlier composition', async () => {
  const plan = composeExample();
  const service = confirmingService();
  const earlier: DepositAuthorization = {
    invocation: {
      root: CURRENT_ROOT,
      pinnedOutputCommitments: ['earlier-composition'],
    },
    sorobanAuthorization: 'earlier-soroban-authorization',
  };

  await expect(confirm(plan, earlier, service.dependencies)).rejects.toThrow(
    DepositAuthorizationMismatchError,
  );
  expect(service.order).toEqual(['quote', 'proof']);
  expect(service.submissions).toEqual([]);
  expect(plan).not.toHaveProperty('id');
});

it('rejects an earlier composition when the Fee quote is above Free tokens', async () => {
  const plan = composeExample();
  const service = confirmingService();
  const dependencies: TestConfirmDependencies = {
    ...service.dependencies,
    feeQuotes: {
      async quote(request) {
        service.order.push('quote');
        service.quotes.push(request);
        return { amount: 3n, collector: 'fee-collector' };
      },
    },
  };
  const earlier: DepositAuthorization = {
    invocation: {
      root: CURRENT_ROOT,
      pinnedOutputCommitments: ['earlier-composition'],
    },
    sorobanAuthorization: 'earlier-soroban-authorization',
  };
  const stored = await plansAReadCanFind(dependencies.store);

  await expect(confirm(plan, earlier, dependencies)).rejects.toThrow(
    DepositAuthorizationMismatchError,
  );
  expect(service.order).toEqual(['quote']);
  expect(service.submissions).toEqual([]);
  expect(await plansAReadCanFind(dependencies.store)).toBe(stored);
  expect(plan).not.toHaveProperty('id');
});

it('rejects a Deposit authorization signed for a root that is not current', async () => {
  const plan = composeExample();
  const service = confirmingService();
  const stale: DepositAuthorization = {
    invocation: {
      root: 'stale-root',
      pinnedOutputCommitments: depositAt(plan, 0).step.pinnedOutputs.map(
        (note) => note.commitment,
      ),
    },
    sorobanAuthorization: SOROBAN_AUTHORIZATION,
  };
  const dependencies: TestConfirmDependencies = {
    ...service.dependencies,
    proofs: {
      async prove(input) {
        service.order.push('proof');
        service.proofRoots.push(input.root);
        return stale.invocation;
      },
    },
  };

  await expect(confirm(plan, stale, dependencies)).rejects.toThrow(
    DepositAuthorizationMismatchError,
  );
  expect(service.proofRoots).toEqual([CURRENT_ROOT]);
  expect(service.submissions).toEqual([]);
});

function withSpentAccumulator(plan: Plan, accumulator: string): Plan {
  const bob = plan.rows[1];
  if (bob?.kind !== 'payout') {
    throw new Error('expected Bob payout');
  }
  const spent = bob.withdrawal.pinnedInputs[0];
  const initial = plan.rows[0];
  if (!spent || initial?.kind !== 'deposit') {
    throw new Error('expected Bob withdrawal to spend a note from the Initial Deposit');
  }
  return {
    rows: [
      initial,
      {
        ...bob,
        withdrawal: {
          ...bob.withdrawal,
          pinnedInputs: [
            {
              ...spent,
              plaintext: { ...spent.plaintext, accumulator },
            },
          ],
        },
      },
      ...plan.rows.slice(2),
    ],
  };
}

it('rejects a note whose accumulator does not match the pinned outputs it spends', async () => {
  const plan = withSpentAccumulator(composeExample(), '001:tampered');
  const service = confirmingService();

  await expect(
    confirm(plan, authorizationFor(plan), service.dependencies),
  ).rejects.toThrow(AccumulatorMismatchError);
  expect(service.order).toEqual([]);
  expect(service.submissions).toEqual([]);
});

it('rejects a non-empty-accumulator note the Service scalar does not own', async () => {
  const plan = composeExample();
  const service = confirmingService();
  const scalars: string[] = [];
  const dependencies: TestConfirmDependencies = {
    ...service.dependencies,
    noteOwnership: {
      async isOwnedByServiceScalar(_note, serviceScalar) {
        scalars.push(serviceScalar);
        return false;
      },
    },
  };

  await expect(confirm(plan, authorizationFor(plan), dependencies)).rejects.toThrow(
    UnownedNoteError,
  );
  expect(scalars).toContain(SERVICE_SCALAR);
  expect(service.order).toEqual([]);
  expect(service.submissions).toEqual([]);
});

it('does not require an empty-accumulator note to be owned by the Service scalar', async () => {
  const plan = withSpentAccumulator(composeExample(), '');
  const service = confirmingService();
  const dependencies: TestConfirmDependencies = {
    ...service.dependencies,
    noteOwnership: {
      async isOwnedByServiceScalar(note) {
        return note.plaintext.accumulator !== '';
      },
    },
  };

  const id = await confirm(plan, authorizationFor(plan), dependencies);

  const saved = await read(id, service.dependencies.store);
  expect(saved).toEqual({
    rows: [
      {
        ...depositAt(plan, 0),
        step: { ...depositAt(plan, 0).step, transactionId: TRANSACTION_ID },
      },
      ...plan.rows.slice(1),
    ],
  });
  expect(saved).not.toHaveProperty('serviceScalar');
  expect(planText(saved)).not.toContain(SERVICE_SCALAR);
});

it('confirms a later Deposit with no proof and no Deposit authorization', async () => {
  const plan = insertDeposit(composeExample(), 2, {
    freeTokenFloor: 2n,
    standardInterval: 7n,
    notes,
  });
  const service = confirmingService();

  const authorization = authorizationFor(plan);
  const id = await confirm(plan, authorization, service.dependencies);
  const saved = await read(id, service.dependencies.store);

  expect(service.provedSteps).toEqual([depositAt(plan, 0).step]);
  expect(service.quotes).toEqual([
    { publicDeposit: 68n, valueMoved: 68n, publicWithdrawal: 0n },
  ]);
  expect(service.submissions).toEqual([
    {
      transaction: {
        envelopeSigner: SERVICE_ACCOUNT,
        invocation: authorization.invocation,
      },
      authorization,
    },
  ]);
  expect(depositAt(saved, 0).step.transactionId).toBe(TRANSACTION_ID);
  expect(planText(saved)).not.toContain(SOROBAN_AUTHORIZATION);
  expect(depositAt(saved, 2).amount).toBe(2n);
  expect(depositAt(saved, 2).step).not.toHaveProperty('transactionId');
  expect(depositAt(saved, 2).step.interval).toBe(7n);
});

async function plansAReadCanFind(store: Pick<PlanStore, 'read'>): Promise<number> {
  let found = 0;
  for (let number = 1; number <= 30; number += 1) {
    try {
      await read(`plan-${String(number)}`, store);
      found += 1;
    } catch (error) {
      if (error instanceof PlanNotFoundError) {
        return found;
      }
      throw error;
    }
  }
  return found;
}

function planText(plan: Plan): string {
  return JSON.stringify(plan, (_key, value: unknown) =>
    typeof value === 'bigint' ? String(value) : value,
  );
}

it('saves the Plan when the Initial Deposit submission fails and drops that authorization', async () => {
  const plan = composeExample();
  const service = confirmingService();
  const dependencies: TestConfirmDependencies = {
    ...service.dependencies,
    pool: {
      async submit(transaction, authorization) {
        if (authorization === undefined) {
          throw new Error('expected a Deposit authorization');
        }
        service.order.push('submit');
        service.submissions.push({ transaction, authorization });
        return { ok: false };
      },
    },
  };

  const id = await confirm(plan, authorizationFor(plan), dependencies);
  const saved = await read(id, service.dependencies.store);

  expect(saved).toEqual(plan);
  expect(depositAt(saved, 0).step).not.toHaveProperty('transactionId');
  expectTypeOf(saved).toEqualTypeOf<Plan>();
  expect(saved).not.toHaveProperty('executionMaterial');
  expect(saved).not.toHaveProperty('depositAuthorizations');
  expect(saved).not.toHaveProperty('serviceScalar');
  expect(planText(saved)).not.toContain(SOROBAN_AUTHORIZATION);
  expect(planText(saved)).not.toContain(SERVICE_SCALAR);
  expect(planText(saved)).not.toContain(SERVICE_ACCOUNT);
});
