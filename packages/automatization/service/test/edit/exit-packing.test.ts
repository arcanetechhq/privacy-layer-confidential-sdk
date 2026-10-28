import { expect, it } from 'vitest';
import {
  isFundedPlan,
  stepsInRow,
  underfundedSteps,
  type PinnedNote,
  type Plan,
  type Step,
} from '@arcanetech/privacy-sdk-automatization-plan';
import { compose, insertDeposit, moveDepositAmount } from '../../src/index.js';
import { notes } from '../support/compose-plan.support.test.js';

const floor = 2n;
const interval = 7n;

function payouts(amounts: readonly bigint[]) {
  return amounts.map((amount, index) => ({
    account: `account-${String(index)}`,
    amount,
  }));
}

function planFor(amounts: readonly bigint[]): Plan {
  return compose(
    { recipients: payouts(amounts), freeTokenFloor: floor, standardInterval: interval },
    notes,
  );
}

function exitNotes(step: Step): PinnedNote[] {
  return step.pinnedOutputs.filter((note) =>
    note.plaintext.accumulator.startsWith('010:'),
  );
}

function remainderNotes(step: Step): PinnedNote[] {
  return step.pinnedOutputs.filter((note) =>
    note.plaintext.accumulator.startsWith('001:'),
  );
}

it('creates Bob, Carol, and Dave as mode 010 notes on the Initial Deposit', () => {
  const plan = planFor([30n, 20n, 10n]);
  const deposit = plan.rows[0];
  if (deposit?.kind !== 'deposit') {
    throw new Error('expected an Initial Deposit');
  }

  expect(deposit.amount).toBe(68n);
  expect(exitNotes(deposit.step).map((note) => note.plaintext)).toEqual([
    { amount: 32n, accumulator: '010:account-0:30' },
    { amount: 22n, accumulator: '010:account-1:20' },
    { amount: 12n, accumulator: '010:account-2:10' },
  ]);
  expect(remainderNotes(deposit.step)).toEqual([]);
  expect(deposit.step.pinnedOutputs).toHaveLength(3);
  expect(plan.rows.filter((row) => row.kind === 'payout' && row.transfer)).toEqual([]);
  for (const [index, row] of plan.rows.slice(1).entries()) {
    if (row.kind !== 'payout') {
      throw new Error('expected a Payout');
    }
    expect(row.transfer).toBeUndefined();
    expect(row.withdrawal.pinnedInputs).toEqual([exitNotes(deposit.step)[index]]);
    expect(row.withdrawal.pinnedOutputs).toEqual([]);
    expect(row.withdrawal.freeTokens).toBe(floor);
  }
  expect(isFundedPlan(plan)).toBe(true);
  expect(underfundedSteps(plan)).toEqual([]);
});

it('uses one intermediate Transfer once four mode 010 notes no longer fit', () => {
  const plan = planFor([30n, 20n, 10n, 15n]);
  const deposit = plan.rows[0];
  const dave = plan.rows[3];
  if (deposit?.kind !== 'deposit' || dave?.kind !== 'payout' || !dave.transfer) {
    throw new Error('expected the Initial Deposit and Dave Transfer');
  }

  expect(exitNotes(deposit.step).map((note) => note.plaintext.accumulator)).toEqual([
    '010:account-0:30',
    '010:account-1:20',
  ]);
  expect(remainderNotes(deposit.step)).toHaveLength(1);
  expect(dave.transfer.pinnedInputs).toEqual(remainderNotes(deposit.step));
  expect(exitNotes(dave.transfer).map((note) => note.plaintext.accumulator)).toEqual([
    '010:account-2:10',
    '010:account-3:15',
  ]);
  expect(plan.rows[1]).toMatchObject({ kind: 'payout' });
  expect(plan.rows[2]).toMatchObject({ kind: 'payout' });
  expect(plan.rows[1]?.kind === 'payout' && plan.rows[1].transfer).toBeUndefined();
  expect(plan.rows[2]?.kind === 'payout' && plan.rows[2].transfer).toBeUndefined();
  expect(deposit.amount).toBe(87n);
  expect(isFundedPlan(plan)).toBe(true);
  expect(underfundedSteps(plan)).toEqual([]);
});

it('fills continuing Steps with two mode 010 notes and the last Step with at most three', () => {
  expect(exitCounts(planFor([1n, 1n, 1n, 1n, 1n]))).toEqual([2, 3]);
  expect(exitCounts(planFor([1n, 1n, 1n, 1n, 1n, 1n]))).toEqual([2, 2, 2]);
  expect(exitCounts(planFor([1n, 1n, 1n, 1n, 1n, 1n, 1n]))).toEqual([2, 2, 3]);
  for (const amounts of [
    [1n],
    [1n, 1n, 1n],
    [1n, 1n, 1n, 1n],
    [1n, 1n, 1n, 1n, 1n, 1n, 1n],
  ]) {
    const plan = planFor(amounts);
    expect(isFundedPlan(plan)).toBe(true);
    expect(underfundedSteps(plan)).toEqual([]);
    for (const row of plan.rows) {
      for (const step of stepsInRow(row)) {
        expect(step.pinnedOutputs.length).toBeLessThanOrEqual(4);
        expect(exitNotes(step).length).toBeLessThanOrEqual(3);
        if (remainderNotes(step).length === 1) {
          expect(exitNotes(step).length).toBeLessThanOrEqual(2);
        }
      }
    }
  }
});

it('merges a later Deposit into the chain instead of starting a Transfer per Payout', () => {
  const plan = insertDeposit(planFor([30n, 20n, 10n]), 2, {
    freeTokenFloor: floor,
    standardInterval: interval,
    notes,
  });
  const moved = moveDepositAmount(
    plan,
    { fromRowIndex: 0, toRowIndex: 2, amount: 20n },
    notes,
  );
  const initial = moved.rows[0];
  const later = moved.rows[2];
  const carol = moved.rows[3];
  const dave = moved.rows[4];
  if (
    initial?.kind !== 'deposit' ||
    later?.kind !== 'deposit' ||
    carol?.kind !== 'payout' ||
    dave?.kind !== 'payout'
  ) {
    throw new Error('expected two Deposits and the later Payouts');
  }

  expect(exitNotes(initial.step).map((note) => note.plaintext.accumulator)).toEqual([
    '010:account-0:30',
  ]);
  expect(later.step.pinnedInputs).toEqual(remainderNotes(initial.step));
  expect(exitNotes(later.step).map((note) => note.plaintext.accumulator)).toEqual([
    '010:account-1:20',
    '010:account-2:10',
  ]);
  expect(carol.transfer).toBeUndefined();
  expect(dave.transfer).toBeUndefined();
  expect(initial.amount).toBe(48n);
  expect(later.amount).toBe(22n);
  expect(isFundedPlan(moved)).toBe(true);
  expect(underfundedSteps(moved)).toEqual([]);
});

function exitCounts(plan: Plan): number[] {
  const counts: number[] = [];
  for (const row of plan.rows) {
    if (row.kind === 'deposit') {
      counts.push(exitNotes(row.step).length);
      continue;
    }
    if (row.transfer) {
      counts.push(exitNotes(row.transfer).length);
    }
  }
  return counts;
}
