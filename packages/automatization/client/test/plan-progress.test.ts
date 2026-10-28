import { describe, expect, it } from 'vitest';
import type {
  PinnedNote,
  PinnedNotePresence,
  Plan,
  Step,
} from '@arcanetech/privacy-sdk-automatization-plan';
import {
  planProgress,
  type PayoutProgress,
  type RowProgress,
  type StepProgress,
} from '../src/index.js';

function pinned(commitment: string, nullifierHash: string, amount: bigint): PinnedNote {
  return {
    plaintext: { amount, accumulator: `pin-${commitment}` },
    commitment,
    nullifierHash,
  };
}

function step(
  freeTokens: bigint,
  pinnedInputs: readonly PinnedNote[] = [],
  pinnedOutputs: readonly PinnedNote[] = [],
): Step {
  return {
    freeTokens,
    interval: 0n,
    pinnedInputs,
    pinnedOutputs,
  };
}

function presence(
  consumedNullifierHashes: readonly string[],
  outputCommitmentsInPoolTree: readonly string[],
): PinnedNotePresence {
  return { consumedNullifierHashes, outputCommitmentsInPoolTree };
}

const emptyReport = presence([], []);

describe('Plan progress', () => {
  it('shows which Stellar account receives which public amount', () => {
    const plan: Plan = {
      rows: [
        {
          kind: 'payout',
          account: 'bob-account',
          amount: 30n,
          transfer: step(1n),
          withdrawal: step(1n),
        },
        {
          kind: 'payout',
          account: 'carol-account',
          amount: 20n,
          transfer: step(1n),
          withdrawal: step(1n),
        },
      ],
    };

    const progress = planProgress(plan, emptyReport);

    expect(
      progress.rows.map((row) => {
        if (row.kind !== 'payout') {
          throw new Error('expected a Payout');
        }
        return { account: row.account, amount: row.amount };
      }),
    ).toEqual([
      { account: 'bob-account', amount: 30n },
      { account: 'carol-account', amount: 20n },
    ]);
  });

  it('shows each Step pinned notes, including each Remainder, and Free tokens as an amount', () => {
    const remainder = pinned('commitment-remainder', 'nullifier-remainder', 8n);
    const afterTransfer = pinned(
      'commitment-after-transfer',
      'nullifier-after-transfer',
      7n,
    );
    const plan: Plan = {
      rows: [
        {
          kind: 'deposit',
          amount: 10n,
          step: step(2n, [], [remainder]),
        },
        {
          kind: 'payout',
          account: 'bob-account',
          amount: 6n,
          transfer: step(1n, [remainder], [afterTransfer]),
          withdrawal: step(1n, [afterTransfer], []),
        },
      ],
    };

    const progress = planProgress(plan, emptyReport);
    const [deposit, payout] = progress.rows;
    if (deposit?.kind !== 'deposit' || payout?.kind !== 'payout') {
      throw new Error('expected a Deposit and a Payout');
    }

    expect(deposit.amount).toBe(10n);
    expect(stepNotes(deposit.step)).toEqual({
      pinnedInputs: [],
      pinnedOutputs: [remainder],
      freeTokens: 2n,
    });
    expect(stepNotes(transferOf(payout))).toEqual({
      pinnedInputs: [remainder],
      pinnedOutputs: [afterTransfer],
      freeTokens: 1n,
    });
    expect(stepNotes(payout.withdrawal)).toEqual({
      pinnedInputs: [afterTransfer],
      pinnedOutputs: [],
      freeTokens: 1n,
    });
  });
});

describe('Executed and blocked Steps', () => {
  it('marks a Step executed only when every pinned input nullifier is consumed and every pinned output commitment is present', () => {
    const inputA = pinned('commitment-a', 'nullifier-a', 4n);
    const inputB = pinned('commitment-b', 'nullifier-b', 5n);
    const outputC = pinned('commitment-c', 'nullifier-c', 3n);
    const outputD = pinned('commitment-d', 'nullifier-d', 4n);
    const plan: Plan = {
      rows: [
        {
          kind: 'payout',
          account: 'bob-account',
          amount: 6n,
          transfer: step(1n, [inputA, inputB], [outputC, outputD]),
          withdrawal: step(1n, [outputC], []),
        },
      ],
    };

    const executed = planProgress(
      plan,
      presence(['nullifier-a', 'nullifier-b'], ['commitment-c', 'commitment-d']),
    );
    const missingNullifier = planProgress(
      plan,
      presence(['nullifier-a'], ['commitment-c', 'commitment-d']),
    );
    const missingCommitment = planProgress(
      plan,
      presence(['nullifier-a', 'nullifier-b'], ['commitment-c']),
    );

    const executedPayout = payoutRow(executed.rows[0]);
    const missingNullifierPayout = payoutRow(missingNullifier.rows[0]);
    const missingCommitmentPayout = payoutRow(missingCommitment.rows[0]);

    expect(transferOf(executedPayout).executed).toBe(true);
    expect(transferOf(executedPayout).blocked).toBe(false);
    expect(transferOf(missingNullifierPayout).executed).toBe(false);
    expect(transferOf(missingCommitmentPayout).executed).toBe(false);
  });

  it('marks a Step with no pinned inputs executed when every pinned output commitment is present', () => {
    const remainder = pinned('commitment-remainder', 'nullifier-remainder', 8n);
    const plan: Plan = {
      rows: [
        {
          kind: 'deposit',
          amount: 10n,
          step: step(2n, [], [remainder]),
        },
      ],
    };

    const present = planProgress(plan, presence([], ['commitment-remainder']));
    const missing = planProgress(plan, emptyReport);
    const presentDeposit = present.rows[0];
    const missingDeposit = missing.rows[0];
    if (presentDeposit?.kind !== 'deposit' || missingDeposit?.kind !== 'deposit') {
      throw new Error('expected a Deposit');
    }

    expect(presentDeposit.step.executed).toBe(true);
    expect(presentDeposit.step.blocked).toBe(false);
    expect(missingDeposit.step.executed).toBe(false);
    expect(missingDeposit.step.blocked).toBe(false);
  });

  it('marks a Step blocked when it is not executed and a pinned input nullifier is consumed', () => {
    const inputA = pinned('commitment-a', 'nullifier-a', 4n);
    const inputB = pinned('commitment-b', 'nullifier-b', 5n);
    const outputC = pinned('commitment-c', 'nullifier-c', 7n);
    const plan: Plan = {
      rows: [
        {
          kind: 'payout',
          account: 'bob-account',
          amount: 6n,
          transfer: step(1n, [inputA, inputB], [outputC]),
          withdrawal: step(1n, [outputC], []),
        },
      ],
    };

    const partial = planProgress(plan, presence(['nullifier-a'], ['commitment-c']));
    const untouched = planProgress(plan, presence([], ['commitment-c']));
    const partialPayout = payoutRow(partial.rows[0]);
    const untouchedPayout = payoutRow(untouched.rows[0]);

    expect(transferOf(partialPayout).executed).toBe(false);
    expect(transferOf(partialPayout).blocked).toBe(true);
    expect(transferOf(untouchedPayout).executed).toBe(false);
    expect(transferOf(untouchedPayout).blocked).toBe(false);
  });

  it('marks executed and blocked from pinned notes alone', () => {
    const inputA = pinned('commitment-a', 'nullifier-a', 4n);
    const outputC = pinned('commitment-c', 'nullifier-c', 3n);
    const plan: Plan = {
      rows: [
        {
          kind: 'deposit',
          amount: 4n,
          step: step(1n, [inputA], [outputC]),
        },
      ],
    };
    const read = () => planProgress(plan, presence(['nullifier-a'], ['commitment-c']));
    const originalFetch = globalThis.fetch;
    globalThis.fetch = () => {
      throw new Error('opened a network connection');
    };

    try {
      const progress = read();
      const deposit = progress.rows[0];
      if (deposit?.kind !== 'deposit') {
        throw new Error('expected a Deposit');
      }
      expect(deposit.step.executed).toBe(true);
      expect(deposit.step.blocked).toBe(false);
    } finally {
      globalThis.fetch = originalFetch;
    }

    const feeReport = planProgress(
      plan,
      presence(['fee-note-nullifier'], ['unspent-note-commitment']),
    );
    const feeDeposit = feeReport.rows[0];
    if (feeDeposit?.kind !== 'deposit') {
      throw new Error('expected a Deposit');
    }
    expect(feeDeposit.step.executed).toBe(false);
    expect(feeDeposit.step.blocked).toBe(false);
  });
});

function payoutRow(row: RowProgress | undefined): PayoutProgress {
  if (row?.kind !== 'payout') {
    throw new Error('expected a Payout');
  }
  return row;
}

function transferOf(payout: PayoutProgress): StepProgress {
  if (payout.transfer === undefined) {
    throw new Error('expected a Transfer');
  }
  return payout.transfer;
}

function stepNotes(shown: StepProgress): {
  pinnedInputs: readonly PinnedNote[];
  pinnedOutputs: readonly PinnedNote[];
  freeTokens: bigint;
} {
  return {
    pinnedInputs: shown.pinnedInputs,
    pinnedOutputs: shown.pinnedOutputs,
    freeTokens: shown.freeTokens,
  };
}
