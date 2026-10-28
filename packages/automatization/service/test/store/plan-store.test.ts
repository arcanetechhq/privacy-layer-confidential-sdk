import { expect, it } from 'vitest';
import type { Plan } from '@arcanetech/privacy-sdk-automatization-plan';
import {
  composePlanStore,
  createDerivedNoteOwnership,
  createMemoryDepositMaterial,
  createMemoryInitialQuotes,
  createMemoryPlanCancellation,
  createMemoryPlanDocuments,
  createMemoryPlanRegistry,
  createMemoryPlanStore,
  createMemoryStepTimes,
  createMemoryUnspentNotes,
  PlanNotFoundError,
  systemClock,
  type DepositAuthorization,
  type NoteDeriver,
  type PreparedDeposit,
} from '../../src/index.js';

const plan: Plan = { rows: [] };
const authorization: DepositAuthorization = {
  invocation: { root: 'root', pinnedOutputCommitments: ['c1'] },
  sorobanAuthorization: 'signed',
};
const prepared: PreparedDeposit = {
  step: { rowIndex: 0, role: 'deposit' },
  quote: { amount: 1n, collector: 'collector' },
  invocation: authorization.invocation,
};

it('numbers Plans from plan-1 and lists every allocated id', async () => {
  const store = createMemoryPlanStore();

  expect(await store.allocateId()).toBe('plan-1');
  expect(await store.allocateId()).toBe('plan-2');
  expect(await store.ids()).toEqual(['plan-1', 'plan-2']);
});

it('throws PlanNotFoundError for a Plan that was never saved', async () => {
  const store = createMemoryPlanStore();

  await expect(store.read('plan-1')).rejects.toThrow(PlanNotFoundError);
  await expect(store.confirmedAt('plan-1')).rejects.toThrow(PlanNotFoundError);
  expect(await store.isCancelled('plan-1')).toBe(false);
  expect(await store.unspentNotes('plan-1')).toEqual([]);
});

it('keeps the first execution time and the first accepted initial quote', async () => {
  const store = createMemoryPlanStore();
  await store.start('plan-1', 5n);
  await store.rememberExecutedAt('plan-1', '0:deposit', 7n);
  await store.rememberExecutedAt('plan-1', '0:deposit', 9n);
  await store.recordAcceptedInitialQuote('plan-1', { amount: 1n, collector: 'a' });
  await store.recordAcceptedInitialQuote('plan-1', { amount: 2n, collector: 'b' });

  expect(await store.confirmedAt('plan-1')).toBe(5n);
  expect(await store.executedAt('plan-1', '0:deposit')).toBe(7n);
  expect(await store.acceptedInitialQuote('plan-1')).toEqual({
    amount: 1n,
    collector: 'a',
  });
});

it('drops Deposit authorizations and prepared Deposits when a Plan is cancelled', async () => {
  const store = createMemoryPlanStore();
  await store.addDepositAuthorization('plan-1', authorization);
  await store.savePreparedDeposit('plan-1', prepared);

  await store.cancel('plan-1');

  expect(await store.isCancelled('plan-1')).toBe(true);
  expect(await store.depositAuthorizations('plan-1')).toEqual([]);
  expect(await store.preparedDeposit('plan-1', prepared.step)).toBeUndefined();
});

it('composes a store from parts so one part can live elsewhere', async () => {
  const deposits = createMemoryDepositMaterial();
  const store = composePlanStore({
    registry: createMemoryPlanRegistry(),
    documents: createMemoryPlanDocuments(),
    times: createMemoryStepTimes(),
    quotes: createMemoryInitialQuotes(),
    cancellation: createMemoryPlanCancellation(),
    deposits,
    unspentNotes: createMemoryUnspentNotes(),
  });
  const id = await store.allocateId();
  await store.savePlan(id, plan);
  await store.addDepositAuthorization(id, authorization);

  expect(await store.read(id)).toBe(plan);
  expect(await deposits.depositAuthorizations(id)).toEqual([authorization]);
});

it('clears every part of the memory store', async () => {
  const store = createMemoryPlanStore();
  const id = await store.allocateId();
  await store.savePlan(id, plan);
  await store.addDepositAuthorization(id, authorization);

  await store.clear();

  expect(await store.ids()).toEqual([]);
  await expect(store.read(id)).rejects.toThrow(PlanNotFoundError);
  expect(await store.depositAuthorizations(id)).toEqual([]);
  expect(await store.allocateId()).toBe('plan-1');
});

it('owns a note only when the service scalar derives its commitment and nullifier hash', async () => {
  const notes: NoteDeriver = {
    derive: (plaintext) => ({
      commitment: `c-${plaintext.amount}`,
      nullifierHash: `n-${plaintext.amount}`,
    }),
  };
  const ownership = createDerivedNoteOwnership(notes, 'service-scalar');
  const note = {
    plaintext: { amount: 3n, accumulator: '001:x' },
    commitment: 'c-3',
    nullifierHash: 'n-3',
  };

  expect(await ownership.isOwnedByServiceScalar(note, 'service-scalar')).toBe(true);
  expect(await ownership.isOwnedByServiceScalar(note, 'other-scalar')).toBe(false);
  expect(
    await ownership.isOwnedByServiceScalar(
      { ...note, commitment: 'c-4' },
      'service-scalar',
    ),
  ).toBe(false);
});

it('reads the system clock in milliseconds', async () => {
  const before = BigInt(Date.now());
  const now = await systemClock.now();

  expect(now >= before).toBe(true);
});
