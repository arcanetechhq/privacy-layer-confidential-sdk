import { describe, expect, it } from 'vitest';
import { isFundedPlan, type Plan } from '../src/index.js';

const depositNote = {
  plaintext: { amount: 90n, accumulator: 'pin-transfer' },
  commitment: 'commitment-after-deposit',
  nullifierHash: 'nullifier-after-deposit',
};

function fundedPlan(depositAmount: bigint): Plan {
  return {
    rows: [
      {
        kind: 'deposit',
        amount: depositAmount,
        step: {
          freeTokens: 10n,
          interval: 0n,
          pinnedInputs: [],
          pinnedOutputs: [depositNote],
        },
      },
      {
        kind: 'payout',
        account: 'bob-account',
        amount: 60n,
        transfer: {
          freeTokens: 15n,
          interval: 0n,
          pinnedInputs: [depositNote],
          pinnedOutputs: [
            {
              plaintext: { amount: 75n, accumulator: 'pin-withdrawal' },
              commitment: 'commitment-after-transfer',
              nullifierHash: 'nullifier-after-transfer',
            },
          ],
        },
        withdrawal: {
          freeTokens: 15n,
          interval: 0n,
          pinnedInputs: [
            {
              plaintext: { amount: 75n, accumulator: 'pin-withdrawal' },
              commitment: 'commitment-after-transfer',
              nullifierHash: 'nullifier-after-transfer',
            },
          ],
          pinnedOutputs: [],
        },
      },
    ],
  };
}

function twoDepositPlan(secondDeposit: bigint): Plan {
  const quiet = {
    pinnedInputs: [],
    pinnedOutputs: [],
  };
  return {
    rows: [
      {
        kind: 'deposit',
        amount: 40n,
        step: { freeTokens: 5n, interval: 0n, ...quiet },
      },
      {
        kind: 'payout',
        account: 'bob-account',
        amount: 20n,
        transfer: { freeTokens: 5n, interval: 0n, ...quiet },
        withdrawal: { freeTokens: 5n, interval: 0n, ...quiet },
      },
      {
        kind: 'deposit',
        amount: secondDeposit,
        step: { freeTokens: 5n, interval: 0n, ...quiet },
      },
      {
        kind: 'payout',
        account: 'carol-account',
        amount: 15n,
        transfer: { freeTokens: 5n, interval: 0n, ...quiet },
        withdrawal: { freeTokens: 5n, interval: 0n, ...quiet },
      },
    ],
  };
}

describe('funded Plan', () => {
  it('is funded when Deposits equal Payouts plus the Free tokens of every Step', () => {
    expect(isFundedPlan(fundedPlan(100n))).toBe(true);
  });

  it('is not funded when Deposits are short of the Payouts and Free tokens', () => {
    expect(isFundedPlan(fundedPlan(99n))).toBe(false);
  });

  it('is not funded when Deposits exceed the Payouts and Free tokens', () => {
    expect(isFundedPlan(fundedPlan(101n))).toBe(false);
  });

  it('is funded when every Deposit, Payout, and Step is included', () => {
    expect(isFundedPlan(twoDepositPlan(25n))).toBe(true);
  });

  it('is not funded when a later Deposit is short', () => {
    expect(isFundedPlan(twoDepositPlan(24n))).toBe(false);
  });
});
