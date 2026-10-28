import { expectTypeOf, expect, it } from 'vitest';
import {
  isFundedPlan,
  underfundedSteps,
} from '@arcanetech/privacy-sdk-automatization-plan';
import {
  compose,
  FreeTokensBelowFloorError,
  InitialDepositIntervalError,
  insertDeposit,
  replaceStepInterval,
  reviseFreeTokens,
} from '../../src/index.js';
import {
  notes,
  recipients,
  depositAt,
  payoutAt,
  composeExample,
} from '../support/compose-plan.support.test.js';

it('builds Bob 30, Carol 20, and Dave 10 into an Initial Deposit of 68', () => {
  expectTypeOf<keyof Parameters<typeof compose>[0]>().toEqualTypeOf<
    'freeTokenFloor' | 'recipients' | 'standardInterval'
  >();

  const plan = compose(
    {
      recipients,
      freeTokenFloor: 2n,
      standardInterval: 7n,
    },
    notes,
  );
  const deposit = depositAt(plan, 0);

  expect(deposit.amount).toBe(68n);
  expect(deposit.step.pinnedOutputs.map((note) => note.plaintext.accumulator)).toEqual([
    '010:bob-account:30',
    '010:carol-account:20',
    '010:dave-account:10',
  ]);
  expect(payoutAt(plan, 1).transfer).toBeUndefined();
  expect(payoutAt(plan, 2).transfer).toBeUndefined();
  expect(payoutAt(plan, 3).transfer).toBeUndefined();
  expect(payoutAt(plan, 1).withdrawal.pinnedInputs).toEqual([
    deposit.step.pinnedOutputs[0],
  ]);
  expect(isFundedPlan(plan)).toBe(true);
  expect(underfundedSteps(plan)).toEqual([]);
});
it('raises the Initial Deposit when a transfer Step keeps more Free tokens', () => {
  const plan = compose(
    {
      recipients: [...recipients, { account: 'erin-account', amount: 15n }],
      freeTokenFloor: 2n,
      standardInterval: 7n,
    },
    notes,
  );
  const revised = reviseFreeTokens(plan, { rowIndex: 3, role: 'transfer' }, 5n, {
    freeTokenFloor: 2n,
    notes,
  });

  // Dave's transfer goes from 2 to 5. The Initial Deposit rises by 3, from 87 to 90.
  expect(depositAt(revised, 0).amount).toBe(90n);
  expect(depositAt(revised, 0).step.freeTokens).toBe(2n);
  expect(depositAt(revised, 0).step.pinnedOutputs[2]?.plaintext.amount).toBe(34n);
  expect(payoutAt(revised, 3).transfer?.freeTokens).toBe(5n);
  expect(payoutAt(revised, 3).transfer?.pinnedInputs[0]?.plaintext.amount).toBe(34n);
  expect(payoutAt(revised, 1).amount).toBe(30n);
  expect(payoutAt(revised, 4).amount).toBe(15n);
  expect(depositAt(plan, 0).amount).toBe(87n);
  expect(isFundedPlan(revised)).toBe(true);
  expect(underfundedSteps(revised)).toEqual([]);
});
it('raises the Initial Deposit when a withdrawal Step keeps more Free tokens', () => {
  const plan = composeExample();
  const revised = reviseFreeTokens(plan, { rowIndex: 1, role: 'withdrawal' }, 5n, {
    freeTokenFloor: 2n,
    notes,
  });

  // Bob's withdrawal goes from 2 to 5. His mode 010 note grows from 32 to 35.
  // The Initial Deposit rises by 3, from 68 to 71.
  expect(depositAt(revised, 0).amount).toBe(71n);
  expect(depositAt(revised, 0).step.pinnedOutputs[0]?.plaintext.amount).toBe(35n);
  expect(payoutAt(revised, 1).withdrawal.freeTokens).toBe(5n);
  expect(payoutAt(revised, 1).amount).toBe(30n);
  expect(payoutAt(revised, 2).amount).toBe(20n);
  expect(depositAt(plan, 0).amount).toBe(68n);
  expect(isFundedPlan(revised)).toBe(true);
  expect(underfundedSteps(revised)).toEqual([]);
});
it('raises a Deposit when that Deposit Step keeps more Free tokens', () => {
  const plan = composeExample();
  const revised = reviseFreeTokens(plan, { rowIndex: 0, role: 'deposit' }, 6n, {
    freeTokenFloor: 2n,
    notes,
  });

  // Initial Deposit Free tokens 2 -> 6, so its amount rises by 4, from 68 to 72.
  // Bob's mode 010 note stays 32 because the withdrawal did not change.
  expect(depositAt(revised, 0).amount).toBe(72n);
  expect(depositAt(revised, 0).step.freeTokens).toBe(6n);
  expect(depositAt(revised, 0).step.pinnedOutputs[0]?.plaintext.amount).toBe(32n);
  expect(payoutAt(revised, 1).amount).toBe(30n);
  expect(depositAt(plan, 0).amount).toBe(68n);
});
it('shrinks the covering Deposit when Free tokens are lowered, and stops at the floor', () => {
  const plan = composeExample();
  const raised = reviseFreeTokens(plan, { rowIndex: 1, role: 'withdrawal' }, 6n, {
    freeTokenFloor: 2n,
    notes,
  });
  // Bob's withdrawal 2 -> 6 adds 4. The Initial Deposit goes from 68 to 72.
  expect(depositAt(raised, 0).amount).toBe(72n);

  const lowered = reviseFreeTokens(raised, { rowIndex: 1, role: 'withdrawal' }, 2n, {
    freeTokenFloor: 2n,
    notes,
  });
  // Back to the floor of 2. The Initial Deposit returns to 68.
  expect(depositAt(lowered, 0).amount).toBe(68n);
  expect(payoutAt(lowered, 1).withdrawal.freeTokens).toBe(2n);
  expect(payoutAt(lowered, 1).amount).toBe(30n);
  expect(payoutAt(lowered, 2).amount).toBe(20n);
  expect(payoutAt(lowered, 3).amount).toBe(10n);

  expect(() =>
    reviseFreeTokens(lowered, { rowIndex: 1, role: 'withdrawal' }, 1n, {
      freeTokenFloor: 2n,
      notes,
    }),
  ).toThrow(FreeTokensBelowFloorError);
  expect(depositAt(lowered, 0).amount).toBe(68n);
  expect(payoutAt(lowered, 1).withdrawal.freeTokens).toBe(2n);
});
it('replaces any later Step interval, including zero, and keeps the Initial Deposit at zero', () => {
  const plan = composeExample();
  const revised = replaceStepInterval(plan, { rowIndex: 1, role: 'withdrawal' }, 0n);
  const withdrawalRevised = replaceStepInterval(
    revised,
    { rowIndex: 3, role: 'withdrawal' },
    0n,
  );

  expect(payoutAt(revised, 1).withdrawal.interval).toBe(0n);
  expect(depositAt(revised, 0).step.interval).toBe(0n);
  expect(depositAt(revised, 0).amount).toBe(68n);
  expect(payoutAt(revised, 1).withdrawal.pinnedInputs[0]?.plaintext.accumulator).toBe(
    '010:bob-account:30',
  );
  expect(payoutAt(plan, 1).withdrawal.interval).toBe(7n);
  expect(payoutAt(withdrawalRevised, 3).withdrawal.interval).toBe(0n);
  expect(payoutAt(withdrawalRevised, 1).withdrawal.interval).toBe(0n);

  expect(() => replaceStepInterval(plan, { rowIndex: 0, role: 'deposit' }, 4n)).toThrow(
    InitialDepositIntervalError,
  );
  expect(() => replaceStepInterval(plan, { rowIndex: 0, role: 'deposit' }, 0n)).toThrow(
    InitialDepositIntervalError,
  );
  expect(depositAt(plan, 0).step.interval).toBe(0n);
});
it('inserts a Deposit between Rows at the Free-token floor', () => {
  const plan = composeExample();
  const revised = insertDeposit(plan, 2, {
    freeTokenFloor: 2n,
    standardInterval: 7n,
    notes,
  });

  // Between Bob and Carol. The new Deposit's amount and Free tokens are both the floor, 2.
  expect(revised.rows).toHaveLength(5);
  expect(depositAt(revised, 2).amount).toBe(2n);
  expect(depositAt(revised, 2).step.freeTokens).toBe(2n);
  expect(depositAt(revised, 2).step.interval).toBe(7n);
  expect(depositAt(revised, 2).step).not.toHaveProperty('transactionId');
  expect(depositAt(revised, 0).amount).toBe(68n);
  expect(depositAt(revised, 0).step.interval).toBe(0n);
  expect(payoutAt(revised, 1).amount).toBe(30n);
  expect(payoutAt(revised, 3).account).toBe('carol-account');
  expect(payoutAt(revised, 3).amount).toBe(20n);
  expect(payoutAt(revised, 4).amount).toBe(10n);

  // The later Deposit merges the Remainder and creates Carol's and Dave's mode 010 notes.
  const remainder = depositAt(revised, 0).step.pinnedOutputs[1];
  expect(remainder?.plaintext.amount).toBe(34n);
  expect(remainder?.plaintext.accumulator.startsWith('001:')).toBe(true);
  expect(depositAt(revised, 2).step.pinnedInputs[0]).toEqual(remainder);
  expect(depositAt(revised, 2).step.pinnedOutputs[0]?.plaintext.accumulator).toBe(
    '010:carol-account:20',
  );
  expect(payoutAt(revised, 3).transfer).toBeUndefined();
  expect(isFundedPlan(revised)).toBe(true);
  expect(underfundedSteps(revised)).toEqual([]);
  expect(plan.rows).toHaveLength(4);
});
it('raises the nearest Deposit before a Step and leaves the earlier Deposit unchanged', () => {
  const plan = insertDeposit(composeExample(), 2, {
    freeTokenFloor: 2n,
    standardInterval: 7n,
    notes,
  });
  const revised = reviseFreeTokens(plan, { rowIndex: 4, role: 'withdrawal' }, 5n, {
    freeTokenFloor: 2n,
    notes,
  });

  // Dave's withdrawal goes from 2 to 5. The Deposit between Bob and Carol rises by 3, from 2 to 5.
  expect(depositAt(revised, 2).amount).toBe(5n);
  expect(depositAt(revised, 2).step.freeTokens).toBe(2n);
  expect(depositAt(revised, 0).amount).toBe(68n);
  expect(payoutAt(revised, 4).withdrawal.freeTokens).toBe(5n);
  expect(payoutAt(revised, 4).amount).toBe(10n);
  expect(payoutAt(revised, 3).amount).toBe(20n);
  expect(payoutAt(revised, 1).amount).toBe(30n);
  expect(depositAt(plan, 2).amount).toBe(2n);
});
