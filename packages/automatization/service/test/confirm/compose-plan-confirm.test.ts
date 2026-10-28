import { expectTypeOf, expect, it } from 'vitest';
import {
  isFundedPlan,
  stepsInRow,
  underfundedSteps,
  type Plan,
} from '@arcanetech/privacy-sdk-automatization-plan';
import {
  confirm,
  insertDeposit,
  PlanNotFoundError,
  read,
  UnderfundedPlanError,
  moveDepositAmount,
  replaceStepInterval,
  reviseFreeTokens,
  createMemoryPlanStore,
} from '../../src/index.js';
import {
  notes,
  depositAt,
  payoutAt,
  composeExample,
  INITIAL_DEPOSIT_TRANSACTION,
  savedPlan,
  authorizationFor,
  confirmingDependencies,
  planText,
  firstUnreadPlanId,
} from '../support/compose-plan.support.test.js';

it('raises an inserted Deposit when that Deposit Step keeps more Free tokens', () => {
  const plan = insertDeposit(composeExample(), 2, {
    freeTokenFloor: 2n,
    standardInterval: 7n,
    notes,
  });
  const revised = reviseFreeTokens(plan, { rowIndex: 2, role: 'deposit' }, 5n, {
    freeTokenFloor: 2n,
    notes,
  });

  // Free tokens 2 -> 5, so that Deposit rises by 3, from 2 to 5. Carol's Remainder stays 38.
  expect(depositAt(revised, 2).amount).toBe(5n);
  expect(depositAt(revised, 2).step.freeTokens).toBe(5n);
  expect(depositAt(revised, 2).step.pinnedOutputs[0]?.plaintext.amount).toBe(22n);
  expect(depositAt(revised, 0).amount).toBe(68n);
});
it('moves amount from an earlier Deposit onto a later one and leaves the Payouts unchanged', () => {
  const plan = insertDeposit(composeExample(), 2, {
    freeTokenFloor: 2n,
    standardInterval: 7n,
    notes,
  });
  const moved = moveDepositAmount(
    plan,
    { fromRowIndex: 0, toRowIndex: 2, amount: 20n },
    notes,
  );

  // 20 leaves the Initial Deposit: 68 -> 48. The later Deposit goes from 2 to 22.
  // Bob's mode 010 note stays 32. The Remainder into the later Deposit shrinks to 14.
  expect(depositAt(moved, 0).amount).toBe(48n);
  expect(depositAt(moved, 0).step.pinnedOutputs[0]?.plaintext.amount).toBe(32n);
  expect(payoutAt(moved, 1).transfer).toBeUndefined();
  expect(depositAt(moved, 2).amount).toBe(22n);
  expect(depositAt(moved, 2).step.pinnedInputs[0]?.plaintext.amount).toBe(14n);
  expect(depositAt(moved, 2).step.pinnedOutputs[0]?.plaintext.amount).toBe(22n);
  expect(payoutAt(moved, 1).amount).toBe(30n);
  expect(payoutAt(moved, 3).amount).toBe(20n);
  expect(payoutAt(moved, 4).amount).toBe(10n);
  expect(isFundedPlan(moved)).toBe(true);
  expect(underfundedSteps(moved)).toEqual([]);
  expect(depositAt(plan, 0).amount).toBe(68n);
  expect(depositAt(plan, 2).amount).toBe(2n);
});
it('does not let a read find a Plan that has only been edited', async () => {
  const store = createMemoryPlanStore();
  const unread = await firstUnreadPlanId(store);
  const plan = composeExample();
  const revised = reviseFreeTokens(plan, { rowIndex: 1, role: 'withdrawal' }, 5n, {
    freeTokenFloor: 2n,
    notes,
  });
  const retimed = replaceStepInterval(revised, { rowIndex: 1, role: 'withdrawal' }, 0n);
  const inserted = insertDeposit(retimed, 2, {
    freeTokenFloor: 2n,
    standardInterval: 7n,
    notes,
  });
  moveDepositAmount(inserted, { fromRowIndex: 0, toRowIndex: 2, amount: 20n }, notes);

  expect(revised).not.toHaveProperty('id');
  await expect(read(unread, store)).rejects.toThrow(PlanNotFoundError);
});
it('reads pinned notes, Free tokens, intervals, Payouts, and the Initial Deposit transaction id', async () => {
  const plan = composeExample();
  const { dependencies } = confirmingDependencies();
  const id = await confirm(plan, authorizationFor(plan), dependencies);
  const saved = await read(id, dependencies.store);
  const initialNote = depositAt(saved, 0).step.pinnedOutputs[0];

  expect(initialNote?.plaintext).toEqual({
    amount: 32n,
    accumulator: '010:bob-account:30',
  });
  expect(initialNote?.commitment).toBe('commitment-32-010:bob-account:30');
  expect(initialNote?.nullifierHash).toBe('nullifier-32-010:bob-account:30');
  expect(depositAt(saved, 0).step.freeTokens).toBe(2n);
  expect(depositAt(saved, 0).step.interval).toBe(0n);
  expect(depositAt(saved, 0).step.transactionId).toBe(INITIAL_DEPOSIT_TRANSACTION);

  expect(payoutAt(saved, 1)).toMatchObject({ account: 'bob-account', amount: 30n });
  expect(payoutAt(saved, 1).transfer).toBeUndefined();
  expect(payoutAt(saved, 1).withdrawal.freeTokens).toBe(2n);
  expect(payoutAt(saved, 1).withdrawal.interval).toBe(7n);
  expect(payoutAt(saved, 1).withdrawal.pinnedInputs[0]).toEqual(initialNote);
  expect(payoutAt(saved, 1).withdrawal.pinnedOutputs).toEqual([]);

  expect(payoutAt(saved, 2)).toMatchObject({ account: 'carol-account', amount: 20n });
  expect(payoutAt(saved, 2).transfer).toBeUndefined();
  expect(payoutAt(saved, 2).withdrawal.freeTokens).toBe(2n);
  expect(payoutAt(saved, 2).withdrawal.interval).toBe(7n);
  expect(payoutAt(saved, 2).withdrawal.pinnedInputs[0]?.plaintext.accumulator).toBe(
    '010:carol-account:20',
  );
  expect(payoutAt(saved, 2).withdrawal.pinnedOutputs).toEqual([]);

  expect(payoutAt(saved, 3)).toMatchObject({ account: 'dave-account', amount: 10n });
  expect(payoutAt(saved, 3).transfer).toBeUndefined();
  expect(payoutAt(saved, 3).withdrawal.freeTokens).toBe(2n);
  expect(payoutAt(saved, 3).withdrawal.interval).toBe(7n);
  expect(payoutAt(saved, 3).withdrawal.pinnedInputs[0]?.plaintext.accumulator).toBe(
    '010:dave-account:10',
  );
  expect(payoutAt(saved, 3).withdrawal.pinnedOutputs).toEqual([]);

  expect(saved).not.toHaveProperty('serviceScalar');
  expect(saved).not.toHaveProperty('executionMaterial');
  expect(saved).not.toHaveProperty('depositAuthorizations');
  expect(planText(saved)).not.toContain('service-scalar-secret');
  expect(planText(saved)).not.toContain('depositor-soroban-authorization');
});
it('confirms the Plan it is given', async () => {
  const plan = composeExample();
  const revised = replaceStepInterval(plan, { rowIndex: 1, role: 'withdrawal' }, 0n);
  const moved = moveDepositAmount(
    insertDeposit(plan, 2, { freeTokenFloor: 2n, standardInterval: 7n, notes }),
    { fromRowIndex: 0, toRowIndex: 2, amount: 20n },
    notes,
  );
  const { dependencies } = confirmingDependencies();

  const revisedId = await confirm(revised, authorizationFor(revised), dependencies);
  expectTypeOf(await read(revisedId, dependencies.store)).toEqualTypeOf<Plan>();
  expect(await read(revisedId, dependencies.store)).not.toHaveProperty('serviceScalar');
  expect(await read(revisedId, dependencies.store)).not.toHaveProperty(
    'executionMaterial',
  );
  expect(await read(revisedId, dependencies.store)).not.toHaveProperty(
    'depositAuthorizations',
  );
  const movedId = await confirm(moved, authorizationFor(moved), dependencies);

  expect(await read(revisedId, dependencies.store)).toEqual(
    savedPlan(revised, INITIAL_DEPOSIT_TRANSACTION),
  );
  expect(payoutAt(revised, 1).withdrawal.interval).toBe(0n);
  expect(revised).not.toHaveProperty('id');
  expect(depositAt(revised, 0).step).not.toHaveProperty('transactionId');
  expect(await read(movedId, dependencies.store)).toEqual(
    savedPlan(moved, INITIAL_DEPOSIT_TRANSACTION),
  );
  expect(depositAt(moved, 0).amount).toBe(48n);
  expect(depositAt(moved, 2).amount).toBe(22n);
  expect(depositAt(await read(movedId, dependencies.store), 0).amount).toBe(48n);
  expect(depositAt(await read(movedId, dependencies.store), 2).amount).toBe(22n);
});
it('refuses confirm while a Step is underfunded', async () => {
  const plan = insertDeposit(composeExample(), 2, {
    freeTokenFloor: 2n,
    standardInterval: 7n,
    notes,
  });
  const moved = moveDepositAmount(
    plan,
    { fromRowIndex: 0, toRowIndex: 2, amount: 39n },
    notes,
  );

  // 39 leaves 29 on the Initial Deposit. Bob's mode 010 note is 32 plus Free tokens 2.
  expect(depositAt(moved, 0).amount).toBe(29n);
  expect(depositAt(moved, 2).amount).toBe(41n);
  expect(depositAt(moved, 0).step.pinnedOutputs[0]?.plaintext.amount).toBe(32n);
  expect(payoutAt(moved, 1).amount).toBe(30n);
  expect(payoutAt(moved, 3).amount).toBe(20n);
  expect(payoutAt(moved, 4).amount).toBe(10n);
  expect(isFundedPlan(moved)).toBe(true);
  expect(underfundedSteps(moved)).toEqual([depositAt(moved, 0).step]);

  const { dependencies, portCalls } = confirmingDependencies();
  await expect(confirm(moved, authorizationFor(moved), dependencies)).rejects.toThrow(
    UnderfundedPlanError,
  );
  expect(portCalls).toEqual([]);
  try {
    await confirm(moved, authorizationFor(moved), dependencies);
  } catch (error) {
    expect(error).toBeInstanceOf(UnderfundedPlanError);
    if (!(error instanceof UnderfundedPlanError)) {
      throw error;
    }
    expect(error.steps).toEqual([depositAt(moved, 0).step]);
  }
});
it('pins at most six inputs and six outputs, and keeps Free tokens off the notes', () => {
  const plan = composeExample();
  const inserted = insertDeposit(plan, 2, {
    freeTokenFloor: 2n,
    standardInterval: 7n,
    notes,
  });

  for (const current of [plan, inserted]) {
    for (const row of current.rows) {
      for (const step of stepsInRow(row)) {
        expect(step.pinnedInputs.length).toBeLessThanOrEqual(6);
        expect(step.pinnedOutputs.length).toBeLessThanOrEqual(6);
        expect(
          step.pinnedOutputs.some((note) => note.plaintext.amount === step.freeTokens),
        ).toBe(false);
      }
    }
  }
});
it('returns an equal new Plan for the same recipients and does not keep the last one', () => {
  const first = composeExample();
  const second = composeExample();
  expect(second).toEqual(first);
  expect(second).not.toBe(first);
  expect(first).not.toHaveProperty('id');
  expect(second).not.toHaveProperty('serviceScalar');
});
