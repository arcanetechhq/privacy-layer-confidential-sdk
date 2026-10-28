import type { Plan } from '@arcanetech/privacy-sdk-automatization-plan';
import { draftsFromPlan, planFromDrafts } from '../../domain/drafts/index.js';
import type { NoteDeriver } from '../../ports/index.js';

export function insertDeposit(
  plan: Plan,
  rowIndex: number,
  limits: {
    readonly freeTokenFloor: bigint;
    readonly standardInterval: bigint;
    readonly notes: NoteDeriver;
  },
): Plan {
  const drafts = draftsFromPlan(plan);
  if (rowIndex <= 0 || rowIndex >= drafts.length) {
    throw new Error('A Deposit can only be inserted between Rows');
  }
  drafts.splice(rowIndex, 0, {
    kind: 'deposit',
    amount: limits.freeTokenFloor,
    freeTokens: limits.freeTokenFloor,
    interval: limits.standardInterval,
  });
  return planFromDrafts(drafts, limits.notes);
}
