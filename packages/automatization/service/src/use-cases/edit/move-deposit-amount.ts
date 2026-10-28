import type { Plan } from '@arcanetech/privacy-sdk-automatization-plan';
import { draftsFromPlan, planFromDrafts } from '../../domain/drafts/index.js';
import type { NoteDeriver } from '../../ports/index.js';

export function moveDepositAmount(
  plan: Plan,
  move: {
    readonly fromRowIndex: number;
    readonly toRowIndex: number;
    readonly amount: bigint;
  },
  notes: NoteDeriver,
): Plan {
  if (move.amount <= 0n) {
    throw new Error('Move a positive amount');
  }
  if (move.fromRowIndex >= move.toRowIndex) {
    throw new Error('Amount moves from an earlier Deposit onto a later one');
  }
  const drafts = draftsFromPlan(plan);
  const source = drafts[move.fromRowIndex];
  const target = drafts[move.toRowIndex];
  if (source?.kind !== 'deposit' || target?.kind !== 'deposit') {
    throw new Error('Amount can only move between Deposits');
  }
  if (source.amount < move.amount) {
    throw new Error('A Deposit amount cannot fall below zero');
  }
  source.amount -= move.amount;
  target.amount += move.amount;
  return planFromDrafts(drafts, notes);
}
