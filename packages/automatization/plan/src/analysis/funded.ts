import type { Plan } from '../document/index.js';
import { stepsInRow } from './steps-in-row.js';

function totalDeposits(plan: Plan): bigint {
  let total = 0n;
  for (const row of plan.rows) {
    if (row.kind === 'deposit') {
      total += row.amount;
    }
  }
  return total;
}

function totalPayouts(plan: Plan): bigint {
  let total = 0n;
  for (const row of plan.rows) {
    if (row.kind === 'payout') {
      total += row.amount;
    }
  }
  return total;
}

function totalFreeTokens(plan: Plan): bigint {
  let total = 0n;
  for (const row of plan.rows) {
    for (const step of stepsInRow(row)) {
      total += step.freeTokens;
    }
  }
  return total;
}

export function isFundedPlan(plan: Plan): boolean {
  return totalDeposits(plan) === totalPayouts(plan) + totalFreeTokens(plan);
}
