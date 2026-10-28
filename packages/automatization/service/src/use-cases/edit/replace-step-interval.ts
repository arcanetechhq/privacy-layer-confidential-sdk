import type { Plan, Row, Step } from '@arcanetech/privacy-sdk-automatization-plan';
import { InitialDepositIntervalError } from '../../errors/index.js';
import { selectRole } from '../../domain/steps/index.js';
import type { StepPlace } from '../../ports/index.js';

function withInterval(step: Step, interval: bigint): Step {
  return { ...step, interval };
}

function replaceRowInterval(row: Row, role: StepPlace['role'], interval: bigint): Row {
  if (row.kind === 'deposit') {
    return {
      ...row,
      step: withInterval(
        selectRole(row.kind, role, {
          deposit: row.step,
          transfer: row.step,
          withdrawal: row.step,
        }),
        interval,
      ),
    };
  }
  if (role === 'transfer' && row.transfer === undefined) {
    throw new Error('That Payout has no Transfer');
  }
  const transfer = row.transfer ?? row.withdrawal;
  const step = selectRole(row.kind, role, {
    deposit: transfer,
    transfer,
    withdrawal: row.withdrawal,
  });
  if (role === 'transfer') {
    return { ...row, transfer: withInterval(step, interval) };
  }
  return { ...row, withdrawal: withInterval(step, interval) };
}

function isInitialDeposit(plan: Plan, place: StepPlace): boolean {
  if (place.role !== 'deposit') {
    return false;
  }
  return plan.rows.findIndex((row) => row.kind === 'deposit') === place.rowIndex;
}

export function replaceStepInterval(
  plan: Plan,
  place: StepPlace,
  interval: bigint,
): Plan {
  if (isInitialDeposit(plan, place)) {
    throw new InitialDepositIntervalError();
  }
  const row = plan.rows[place.rowIndex];
  if (!row) {
    throw new Error('No Row at that index');
  }
  return {
    rows: plan.rows.map((current, index) =>
      index === place.rowIndex
        ? replaceRowInterval(current, place.role, interval)
        : current,
    ),
  };
}
