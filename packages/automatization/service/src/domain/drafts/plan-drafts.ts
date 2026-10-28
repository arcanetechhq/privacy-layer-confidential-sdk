import type { PinnedNote, Plan } from '@arcanetech/privacy-sdk-automatization-plan';

export interface DepositDraft {
  kind: 'deposit';
  amount: bigint;
  freeTokens: bigint;
  interval: bigint;
}

export interface PayoutDraft {
  kind: 'payout';
  account: string;
  amount: bigint;
  transferFreeTokens: bigint;
  transferInterval: bigint;
  withdrawalFreeTokens: bigint;
  withdrawalInterval: bigint;
}

export type RowDraft = DepositDraft | PayoutDraft;

// A 6×6 transaction has six output notes. Three stay open for the Fee note,
// Free tokens, and Change. A Step that also forwards a Remainder can pin two
// mode 010 notes; the last Step in a chain can pin three.
const OUTPUT_SLOTS = 6;
const RESERVED_OUTPUT_SLOTS = 3;
const TERMINAL_EXIT_SLOTS = OUTPUT_SLOTS - RESERVED_OUTPUT_SLOTS;
const CONTINUING_EXIT_SLOTS = TERMINAL_EXIT_SLOTS - 1;

export interface ExitDraft {
  readonly draftIndex: number;
  readonly account: string;
  readonly payoutAmount: bigint;
  readonly noteAmount: bigint;
  readonly withdrawalFreeTokens: bigint;
  readonly withdrawalInterval: bigint;
  readonly transferFreeTokens: bigint;
  readonly transferInterval: bigint;
}

export interface SegmentDraft {
  readonly depositIndex: number;
  readonly deposit: DepositDraft;
  readonly exits: readonly ExitDraft[];
}

export interface CreatorBuild {
  readonly kind: 'deposit' | 'transfer';
  readonly draftIndex: number;
  readonly freeTokens: bigint;
  readonly interval: bigint;
  readonly publicDeposit: bigint;
  readonly exits: readonly PinnedNote[];
  remainder?: PinnedNote;
  incoming?: PinnedNote;
  change?: PinnedNote;
}

export function segmentsOf(drafts: readonly RowDraft[]): SegmentDraft[] {
  const segments: SegmentDraft[] = [];
  let current: SegmentDraft | undefined;
  for (const [index, row] of drafts.entries()) {
    if (row.kind === 'deposit') {
      current = { depositIndex: index, deposit: row, exits: [] };
      segments.push(current);
      continue;
    }
    if (!current) {
      throw new Error('Plan must start with an Initial Deposit');
    }
    current = {
      ...current,
      exits: [
        ...current.exits,
        {
          draftIndex: index,
          account: row.account,
          payoutAmount: row.amount,
          noteAmount: row.amount + row.withdrawalFreeTokens,
          withdrawalFreeTokens: row.withdrawalFreeTokens,
          withdrawalInterval: row.withdrawalInterval,
          transferFreeTokens: row.transferFreeTokens,
          transferInterval: row.transferInterval,
        },
      ],
    };
    segments[segments.length - 1] = current;
  }
  return segments;
}

export function batchSizes(count: number, forwards: boolean): number[] {
  if (count === 0) {
    return [0];
  }
  const lastCapacity = forwards ? CONTINUING_EXIT_SLOTS : TERMINAL_EXIT_SLOTS;
  const sizes: number[] = [];
  let left = count;
  while (left > lastCapacity) {
    sizes.push(CONTINUING_EXIT_SLOTS);
    left -= CONTINUING_EXIT_SLOTS;
  }
  sizes.push(left);
  return sizes;
}

export function draftsFromPlan(plan: Plan): RowDraft[] {
  return plan.rows.map((row) => {
    if (row.kind === 'deposit') {
      return {
        kind: 'deposit',
        amount: row.amount,
        freeTokens: row.step.freeTokens,
        interval: row.step.interval,
      };
    }
    return {
      kind: 'payout',
      account: row.account,
      amount: row.amount,
      transferFreeTokens: row.transfer?.freeTokens ?? row.withdrawal.freeTokens,
      transferInterval: row.transfer?.interval ?? row.withdrawal.interval,
      withdrawalFreeTokens: row.withdrawal.freeTokens,
      withdrawalInterval: row.withdrawal.interval,
    };
  });
}
