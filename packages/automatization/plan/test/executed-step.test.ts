import { describe, expect, it } from 'vitest';
import {
  isBlockedStep,
  isExecutedStep,
  type PinnedNote,
  type PinnedNotePresence,
  type Step,
} from '../src/index.js';

function pinned(commitment: string, nullifierHash: string): PinnedNote {
  return {
    plaintext: { amount: 1n, accumulator: 'pin' },
    commitment,
    nullifierHash,
  };
}

function transfer(
  pinnedInputs: readonly PinnedNote[],
  pinnedOutputs: readonly PinnedNote[],
  transactionId?: string,
): Step {
  const step = {
    freeTokens: 1n,
    interval: 0n,
    pinnedInputs,
    pinnedOutputs,
  };
  if (transactionId === undefined) {
    return step;
  }
  return { ...step, transactionId };
}

const inputA = pinned('commitment-a', 'nullifier-a');
const inputB = pinned('commitment-b', 'nullifier-b');
const outputC = pinned('commitment-c', 'nullifier-c');
const outputD = pinned('commitment-d', 'nullifier-d');

function presence(
  consumedNullifierHashes: readonly string[],
  outputCommitmentsInPoolTree: readonly string[],
): PinnedNotePresence {
  return { consumedNullifierHashes, outputCommitmentsInPoolTree };
}

describe('Executed Step', () => {
  it('is executed when every pinned input nullifier is consumed and every pinned output commitment is in the pool tree', () => {
    const step = transfer([inputA, inputB], [outputC, outputD]);
    const report = presence(
      ['nullifier-a', 'nullifier-b'],
      ['commitment-c', 'commitment-d'],
    );

    expect(isExecutedStep(step, report)).toBe(true);
    expect(isBlockedStep(step, report)).toBe(false);
  });

  it('is executed without a transaction id', () => {
    const step = transfer([inputA], [outputC]);
    const report = presence(['nullifier-a'], ['commitment-c']);

    expect(step).not.toHaveProperty('transactionId');
    expect(isExecutedStep(step, report)).toBe(true);
  });

  it('is not executed when a transaction id is present but a pinned nullifier is not consumed', () => {
    const step = transfer([inputA], [outputC], 'tx-transfer');
    const report = presence([], ['commitment-c']);

    expect(step.transactionId).toBe('tx-transfer');
    expect(isExecutedStep(step, report)).toBe(false);
  });

  it('is not executed when a pinned output commitment is missing from the pool tree', () => {
    const step = transfer([inputA], [outputC, outputD]);
    const report = presence(['nullifier-a'], ['commitment-c']);

    expect(isExecutedStep(step, report)).toBe(false);
  });

  it('is executed when a Step has no pinned inputs and every pinned output commitment is in the pool tree', () => {
    const step = transfer([], [outputC]);
    const report = presence([], ['commitment-c']);

    expect(isExecutedStep(step, report)).toBe(true);
    expect(isBlockedStep(step, report)).toBe(false);
  });
});

describe('Blocked Step', () => {
  it('is blocked when a pinned input nullifier is consumed and the Step is not executed', () => {
    const step = transfer([inputA, inputB], [outputC]);
    const report = presence(['nullifier-a'], ['commitment-c']);

    expect(isExecutedStep(step, report)).toBe(false);
    expect(isBlockedStep(step, report)).toBe(true);
  });

  it('is blocked when every pinned input nullifier is consumed and a pinned output commitment is missing', () => {
    const step = transfer([inputA], [outputC, outputD]);
    const report = presence(['nullifier-a'], ['commitment-c']);

    expect(isBlockedStep(step, report)).toBe(true);
  });

  it('is not blocked when no pinned input nullifier is consumed', () => {
    const step = transfer([inputA], [outputC]);
    const report = presence([], ['commitment-c']);

    expect(isBlockedStep(step, report)).toBe(false);
  });

  it('ignores Fee notes and Unspent notes', () => {
    const step = transfer([inputA], [outputC]);
    const unrelated = presence(['fee-note-nullifier'], ['unspent-note-commitment']);
    const pinnedOnly = presence(['nullifier-a'], ['commitment-c']);

    expect(isExecutedStep(step, unrelated)).toBe(false);
    expect(isBlockedStep(step, unrelated)).toBe(false);
    expect(isExecutedStep(step, pinnedOnly)).toBe(true);
    expect(step).not.toHaveProperty('feeNote');
    expect(step).not.toHaveProperty('unspentNote');
  });
});
