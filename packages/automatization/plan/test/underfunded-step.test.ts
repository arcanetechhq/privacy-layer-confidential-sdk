import { describe, expect, it } from 'vitest';
import {
  underfundedSteps,
  type PinnedNote,
  type Plan,
  type Step,
} from '../src/index.js';

function note(amount: bigint, commitment: string): PinnedNote {
  return {
    plaintext: { amount, accumulator: '' },
    commitment,
    nullifierHash: commitment,
  };
}

function step(
  freeTokens: bigint,
  interval: bigint,
  pinnedOutputs: readonly PinnedNote[],
  pinnedInputs: readonly PinnedNote[] = [],
): Step {
  return { freeTokens, interval, pinnedInputs, pinnedOutputs };
}

describe('Underfunded Step', () => {
  it('is underfunded when pinned outputs and Free tokens exceed its Deposit', () => {
    const deposit = step(4n, 0n, [note(7n, 'out')]);
    const plan: Plan = { rows: [{ kind: 'deposit', amount: 10n, step: deposit }] };

    expect(underfundedSteps(plan)).toEqual([deposit]);
  });

  it('is not underfunded when pinned outputs and Free tokens equal the Deposit', () => {
    const deposit = step(3n, 0n, [note(7n, 'out')]);
    const plan: Plan = { rows: [{ kind: 'deposit', amount: 10n, step: deposit }] };

    expect(underfundedSteps(plan)).toEqual([]);
  });

  it('does not add a Deposit to a later Payout Step', () => {
    const deposit = step(0n, 0n, [note(5n, 'left')]);
    const transfer = step(0n, 1n, [note(6n, 'more')]);
    const withdrawal = step(0n, 2n, []);
    const plan: Plan = {
      rows: [
        { kind: 'deposit', amount: 5n, step: deposit },
        {
          kind: 'payout',
          account: 'bob-account',
          amount: 30n,
          transfer,
          withdrawal,
        },
      ],
    };

    expect(underfundedSteps(plan)).toEqual([transfer]);
  });

  it('counts a note an earlier Step left when a later Step did not spend it', () => {
    const deposit = step(0n, 0n, [note(10n, 'note-a'), note(3n, 'note-b')]);
    const transfer = step(0n, 1n, [note(1n, 'note-c')], [note(10n, 'note-a')]);
    const withdrawal = step(0n, 2n, [note(4n, 'note-d')]);
    const plan: Plan = {
      rows: [
        { kind: 'deposit', amount: 13n, step: deposit },
        {
          kind: 'payout',
          account: 'bob-account',
          amount: 0n,
          transfer,
          withdrawal,
        },
      ],
    };

    expect(underfundedSteps(plan)).toEqual([]);
  });

  it('drops a note once an earlier Step spends it', () => {
    const deposit = step(0n, 0n, [note(10n, 'note-a'), note(3n, 'note-b')]);
    const transfer = step(0n, 1n, [note(1n, 'note-c')], [note(10n, 'note-a')]);
    const withdrawal = step(0n, 2n, [note(5n, 'note-d')]);
    const plan: Plan = {
      rows: [
        { kind: 'deposit', amount: 13n, step: deposit },
        {
          kind: 'payout',
          account: 'bob-account',
          amount: 0n,
          transfer,
          withdrawal,
        },
      ],
    };

    expect(underfundedSteps(plan)).toEqual([withdrawal]);
  });

  it('ignores a pinned input an earlier Step did not leave', () => {
    const deposit = step(0n, 0n, [note(5n, 'real')]);
    const transfer = step(0n, 1n, [note(9n, 'out')], [note(100n, 'imaginary')]);
    const plan: Plan = {
      rows: [
        { kind: 'deposit', amount: 5n, step: deposit },
        {
          kind: 'payout',
          account: 'bob-account',
          amount: 0n,
          transfer,
          withdrawal: step(0n, 2n, []),
        },
      ],
    };

    expect(underfundedSteps(plan)).toEqual([transfer]);
  });

  it('sums every pinned output', () => {
    const deposit = step(1n, 0n, [note(4n, 'one'), note(6n, 'two')]);
    const plan: Plan = { rows: [{ kind: 'deposit', amount: 10n, step: deposit }] };

    expect(underfundedSteps(plan)).toEqual([deposit]);
  });

  it('does not treat a Payout amount as notes left or as a pinned output', () => {
    const deposit = step(0n, 0n, [note(10n, 'left')]);
    const transfer = step(0n, 1n, [note(10n, 'moved')], [note(10n, 'left')]);
    const withdrawal = step(0n, 2n, [], [note(10n, 'moved')]);
    const plan: Plan = {
      rows: [
        { kind: 'deposit', amount: 10n, step: deposit },
        {
          kind: 'payout',
          account: 'bob-account',
          amount: 30n,
          transfer,
          withdrawal,
        },
      ],
    };

    expect(underfundedSteps(plan)).toEqual([]);
  });

  it('lists each Underfunded Step in Plan order', () => {
    const deposit = step(6n, 0n, []);
    const transfer = step(1n, 1n, []);
    const plan: Plan = {
      rows: [
        { kind: 'deposit', amount: 5n, step: deposit },
        {
          kind: 'payout',
          account: 'bob-account',
          amount: 0n,
          transfer,
          withdrawal: step(0n, 2n, []),
        },
      ],
    };

    expect(underfundedSteps(plan)).toEqual([deposit, transfer]);
  });
});
