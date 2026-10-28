import type { Plan } from '@arcanetech/privacy-sdk-automatization-plan';
import {
  draftsFromPlan,
  planFromDrafts,
  type RowDraft,
} from '../../domain/drafts/index.js';
import { selectRole } from '../../domain/steps/index.js';
import { FreeTokensBelowFloorError } from '../../errors/index.js';
import type { NoteDeriver, StepPlace } from '../../ports/index.js';

function rowAt(drafts: readonly RowDraft[], rowIndex: number): RowDraft {
  const row = drafts[rowIndex];
  if (!row) {
    throw new Error('No Row at that index');
  }
  return row;
}

function replaceFreeTokens(
  row: RowDraft,
  role: StepPlace['role'],
  freeTokens: bigint,
): bigint {
  if (row.kind === 'deposit') {
    const previous = selectRole(row.kind, role, {
      deposit: row.freeTokens,
      transfer: row.freeTokens,
      withdrawal: row.freeTokens,
    });
    row.freeTokens = freeTokens;
    return previous;
  }
  const previous = selectRole(row.kind, role, {
    deposit: row.transferFreeTokens,
    transfer: row.transferFreeTokens,
    withdrawal: row.withdrawalFreeTokens,
  });
  if (role === 'transfer') {
    row.transferFreeTokens = freeTokens;
  } else {
    row.withdrawalFreeTokens = freeTokens;
  }
  return previous;
}

function coveringDepositIndex(drafts: readonly RowDraft[], rowIndex: number): number {
  for (let index = rowIndex; index >= 0; index -= 1) {
    if (drafts[index]?.kind === 'deposit') {
      return index;
    }
  }
  throw new Error('No Deposit covers this Step');
}

export function reviseFreeTokens(
  plan: Plan,
  place: StepPlace,
  freeTokens: bigint,
  limits: { readonly freeTokenFloor: bigint; readonly notes: NoteDeriver },
): Plan {
  if (freeTokens < limits.freeTokenFloor) {
    throw new FreeTokensBelowFloorError();
  }
  const current = plan.rows[place.rowIndex];
  if (
    current?.kind === 'payout' &&
    place.role === 'transfer' &&
    current.transfer === undefined
  ) {
    throw new Error('That Payout has no Transfer');
  }
  const drafts = draftsFromPlan(plan);
  const row = rowAt(drafts, place.rowIndex);
  const previous = replaceFreeTokens(row, place.role, freeTokens);
  const depositIndex = coveringDepositIndex(drafts, place.rowIndex);
  const deposit = drafts[depositIndex];
  if (deposit?.kind !== 'deposit') {
    throw new Error('No Deposit covers this Step');
  }
  deposit.amount += freeTokens - previous;
  return planFromDrafts(drafts, limits.notes);
}
