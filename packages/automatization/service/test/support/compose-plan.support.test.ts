import { expect, it } from 'vitest';
import {
  type Deposit,
  type Payout,
  type PinnedNote,
  type Plan,
} from '@arcanetech/privacy-sdk-automatization-plan';
import {
  compose,
  PlanNotFoundError,
  read,
  createMemoryPlanStore,
  type ConfirmDependencies,
  type MemoryPlanStore,
  type PlanStore,
  type DepositAuthorization,
  type NoteDeriver,
} from '../../src/index.js';

type TestConfirmDependencies = ConfirmDependencies & {
  readonly store: MemoryPlanStore;
};

// Built from the end at Free-token floor 2.
// Dave withdrawal spends 10 + 2 = 12.
// Dave transfer spends 12 + 2 = 14.
// Carol withdrawal spends 14 + 20 + 2 = 36.
// Carol transfer spends 36 + 2 = 38.
// Bob withdrawal spends 38 + 30 + 2 = 70.
// Bob transfer spends 70 + 2 = 72.
// Initial Deposit brings 72 + 2 = 74, payouts 60 plus seven Steps at 2.
export const createdByDaveTransfer: PinnedNote = {
  plaintext: { amount: 12n, accumulator: '001:' },
  commitment: 'commitment-dave-transfer',
  nullifierHash: 'nullifier-dave-transfer',
};
export const createdByCarolWithdrawal: PinnedNote = {
  plaintext: { amount: 14n, accumulator: '001:commitment-dave-transfer' },
  commitment: 'commitment-carol-withdrawal',
  nullifierHash: 'nullifier-carol-withdrawal',
};
export const createdByCarolTransfer: PinnedNote = {
  plaintext: { amount: 36n, accumulator: '001:commitment-carol-withdrawal' },
  commitment: 'commitment-carol-transfer',
  nullifierHash: 'nullifier-carol-transfer',
};
export const createdByBobWithdrawal: PinnedNote = {
  plaintext: { amount: 38n, accumulator: '001:commitment-carol-transfer' },
  commitment: 'commitment-bob-withdrawal',
  nullifierHash: 'nullifier-bob-withdrawal',
};
export const createdByBobTransfer: PinnedNote = {
  plaintext: { amount: 70n, accumulator: '001:commitment-bob-withdrawal' },
  commitment: 'commitment-bob-transfer',
  nullifierHash: 'nullifier-bob-transfer',
};
export const createdByInitialDeposit: PinnedNote = {
  plaintext: { amount: 72n, accumulator: '001:commitment-bob-transfer' },
  commitment: 'commitment-initial-deposit',
  nullifierHash: 'nullifier-initial-deposit',
};
export function derivation(note: PinnedNote): {
  commitment: string;
  nullifierHash: string;
} {
  return { commitment: note.commitment, nullifierHash: note.nullifierHash };
}
export function plaintextKey(amount: bigint, accumulator: string): string {
  return `${amount}:${accumulator}`;
}
export const knownNotes = new Map<
  string,
  { commitment: string; nullifierHash: string }
>([
  [plaintextKey(12n, '001:'), derivation(createdByDaveTransfer)],
  [
    plaintextKey(14n, '001:commitment-dave-transfer'),
    derivation(createdByCarolWithdrawal),
  ],
  [
    plaintextKey(36n, '001:commitment-carol-withdrawal'),
    derivation(createdByCarolTransfer),
  ],
  [
    plaintextKey(38n, '001:commitment-carol-transfer'),
    derivation(createdByBobWithdrawal),
  ],
  [
    plaintextKey(70n, '001:commitment-bob-withdrawal'),
    derivation(createdByBobTransfer),
  ],
  [
    plaintextKey(72n, '001:commitment-bob-transfer'),
    derivation(createdByInitialDeposit),
  ],
  [
    plaintextKey(75n, '001:commitment-bob-transfer'),
    {
      commitment: 'commitment-after-raising-bob-transfer',
      nullifierHash: 'nullifier-after-raising-bob-transfer',
    },
  ],
  [
    plaintextKey(38n, '001:commitment-bob-withdrawal'),
    {
      commitment: 'commitment-into-inserted-deposit',
      nullifierHash: 'nullifier-into-inserted-deposit',
    },
  ],
]);
export const notes: NoteDeriver = {
  derive(plaintext) {
    const derived = knownNotes.get(
      plaintextKey(plaintext.amount, plaintext.accumulator),
    );
    if (!derived) {
      return {
        commitment: `commitment-${plaintext.amount}-${plaintext.accumulator}`,
        nullifierHash: `nullifier-${plaintext.amount}-${plaintext.accumulator}`,
      };
    }
    return derived;
  },
};
export const recipients = [
  { account: 'bob-account', amount: 30n },
  { account: 'carol-account', amount: 20n },
  { account: 'dave-account', amount: 10n },
] as const;
export function depositAt(plan: Plan, index: number): Deposit {
  const row = plan.rows[index];
  if (row?.kind !== 'deposit') {
    throw new Error(`expected a Deposit at ${index}`);
  }
  return row;
}
export function payoutAt(plan: Plan, index: number): Payout {
  const row = plan.rows[index];
  if (row?.kind !== 'payout') {
    throw new Error(`expected a Payout at ${index}`);
  }
  return row;
}
export function composeExample(): Plan {
  return compose({ recipients, freeTokenFloor: 2n, standardInterval: 7n }, notes);
}
export const INITIAL_DEPOSIT_TRANSACTION = 'tx-initial-deposit';
export function savedPlan(plan: Plan, transactionId: string): Plan {
  const initial = plan.rows[0];
  if (initial?.kind !== 'deposit') {
    throw new Error('expected an Initial Deposit');
  }
  return {
    rows: [
      { ...initial, step: { ...initial.step, transactionId } },
      ...plan.rows.slice(1),
    ],
  };
}
export function authorizationFor(plan: Plan): DepositAuthorization {
  const initial = plan.rows[0];
  if (initial?.kind !== 'deposit') {
    throw new Error('expected an Initial Deposit');
  }
  return {
    invocation: {
      root: 'current-root',
      pinnedOutputCommitments: initial.step.pinnedOutputs.map(
        (note) => note.commitment,
      ),
    },
    sorobanAuthorization: 'depositor-soroban-authorization',
  };
}
export function confirmingDependencies(): {
  dependencies: TestConfirmDependencies;
  portCalls: string[];
} {
  const portCalls: string[] = [];
  return {
    portCalls,
    dependencies: {
      serviceAccount: 'service-account',
      serviceScalar: 'service-scalar-secret',
      currentRoot: { current: async () => 'current-root' },
      feeQuotes: {
        quote: async () => {
          portCalls.push('quote');
          return { amount: 1n, collector: 'fee-collector' };
        },
      },
      proofs: {
        prove: async (input) => {
          portCalls.push('proof');
          return {
            root: input.root,
            pinnedOutputCommitments: input.step.pinnedOutputs.map(
              (note) => note.commitment,
            ),
          };
        },
      },
      inspection: {
        inspect: async () => 'accept' as const,
      },
      pool: {
        submit: async () => {
          portCalls.push('submit');
          return { ok: true, transactionId: INITIAL_DEPOSIT_TRANSACTION };
        },
      },
      noteOwnership: {
        isOwnedByServiceScalar: async () => true,
      },
      clock: { now: async () => 0n },
      freshScalars: { next: async () => 'unspent-scalar' },
      store: createMemoryPlanStore(),
    },
  };
}
export function planText(plan: Plan): string {
  return JSON.stringify(plan, (_key, value: unknown) =>
    typeof value === 'bigint' ? String(value) : value,
  );
}
export async function firstUnreadPlanId(
  store: Pick<PlanStore, 'read'>,
): Promise<string> {
  for (let number = 1; number <= 30; number += 1) {
    const id = `plan-${String(number)}`;
    try {
      await read(id, store);
    } catch (error) {
      if (error instanceof PlanNotFoundError) {
        return id;
      }
      throw error;
    }
  }
  throw new Error('no unread Plan id');
}

it('builds the example Initial Deposit at the Free-token floor', async () => {
  expect(composeExample().rows[0]).toMatchObject({ kind: 'deposit', amount: 68n });
});
