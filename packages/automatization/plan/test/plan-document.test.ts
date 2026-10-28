import { describe, expect, it } from 'vitest';
import type { Deposit, Payout, Plan, Row } from '../src/index.js';

function asDeposit(row: Row | undefined): Deposit {
  if (row?.kind !== 'deposit') {
    throw new Error('expected a Deposit');
  }
  return row;
}

function asPayout(row: Row | undefined): Payout {
  if (row?.kind !== 'payout') {
    throw new Error('expected a Payout');
  }
  return row;
}

describe('Plan document', () => {
  it('reads pinned note plaintext, Free tokens, the Step interval, the Payout, and a transaction id', () => {
    const plan: Plan = {
      rows: [
        {
          kind: 'deposit',
          amount: 33n,
          step: {
            freeTokens: 1n,
            interval: 0n,
            pinnedInputs: [],
            pinnedOutputs: [
              {
                plaintext: { amount: 32n, accumulator: 'pin-transfer' },
                commitment: 'commitment-remainder',
                nullifierHash: 'nullifier-remainder',
              },
            ],
            transactionId: 'tx-deposit',
          },
        },
        {
          kind: 'payout',
          account: 'bob-account',
          amount: 30n,
          transfer: {
            freeTokens: 1n,
            interval: 5n,
            pinnedInputs: [
              {
                plaintext: { amount: 32n, accumulator: 'pin-transfer' },
                commitment: 'commitment-remainder',
                nullifierHash: 'nullifier-remainder',
              },
            ],
            pinnedOutputs: [],
          },
          withdrawal: {
            freeTokens: 1n,
            interval: 5n,
            pinnedInputs: [],
            pinnedOutputs: [],
            transactionId: 'tx-withdraw',
          },
        },
      ],
    };

    const [depositRow, payoutRow] = plan.rows;
    const deposit = asDeposit(depositRow);
    const payout = asPayout(payoutRow);

    expect(deposit.amount).toBe(33n);
    expect(deposit.step.freeTokens).toBe(1n);
    expect(deposit.step.interval).toBe(0n);
    expect(deposit.step.transactionId).toBe('tx-deposit');
    expect(deposit.step.pinnedOutputs[0]?.plaintext).toEqual({
      amount: 32n,
      accumulator: 'pin-transfer',
    });
    expect(deposit.step.pinnedOutputs[0]?.commitment).toBe('commitment-remainder');
    expect(deposit.step.pinnedOutputs[0]?.nullifierHash).toBe('nullifier-remainder');
    expect(payout.account).toBe('bob-account');
    expect(payout.amount).toBe(30n);
    expect(payout.transfer?.interval).toBe(5n);
    expect(payout.transfer).not.toHaveProperty('transactionId');
    expect(payout.withdrawal.transactionId).toBe('tx-withdraw');
  });
});
