import {
  isExecutedStep,
  type PinnedNotePresence,
  type Plan,
  type Step,
} from '@arcanetech/privacy-sdk-automatization-plan';
import type { ExecutionTimes, StepPlace } from '../../ports/index.js';

export interface StepClock {
  readonly store: ExecutionTimes;
  readonly now: bigint;
}

export interface LocatedStep {
  readonly index: number;
  readonly place: StepPlace;
  readonly step: Step;
  readonly publicDeposit: bigint;
  readonly publicWithdrawal: bigint;
  readonly recipient: string;
}

export function locateSteps(plan: Plan): LocatedStep[] {
  const located: LocatedStep[] = [];
  for (const [rowIndex, row] of plan.rows.entries()) {
    if (row.kind === 'deposit') {
      located.push({
        index: located.length,
        place: { rowIndex, role: 'deposit' },
        step: row.step,
        publicDeposit: row.amount,
        publicWithdrawal: 0n,
        recipient: '',
      });
      continue;
    }
    if (row.transfer !== undefined) {
      located.push({
        index: located.length,
        place: { rowIndex, role: 'transfer' },
        step: row.transfer,
        publicDeposit: 0n,
        publicWithdrawal: 0n,
        recipient: row.account,
      });
    }
    located.push({
      index: located.length,
      place: { rowIndex, role: 'withdrawal' },
      step: row.withdrawal,
      publicDeposit: 0n,
      publicWithdrawal: row.amount,
      recipient: row.account,
    });
  }
  return located;
}

function stepKey(place: StepPlace): string {
  return `${place.rowIndex}:${place.role}`;
}

export async function stampExecuted(
  id: string,
  located: readonly LocatedStep[],
  presence: PinnedNotePresence,
  clock: StepClock,
): Promise<void> {
  for (const locatedStep of located) {
    if (!isExecutedStep(locatedStep.step, presence)) {
      return;
    }
    await clock.store.rememberExecutedAt(id, stepKey(locatedStep.place), clock.now);
  }
}

export function earliestOpenStep(
  located: readonly LocatedStep[],
  presence: PinnedNotePresence,
): LocatedStep | undefined {
  return located.find((locatedStep) => !isExecutedStep(locatedStep.step, presence));
}

export async function intervalElapsed(
  id: string,
  located: readonly LocatedStep[],
  candidate: LocatedStep,
  clock: StepClock,
): Promise<boolean> {
  if (candidate.index === 0) {
    return clock.now >= (await clock.store.confirmedAt(id)) + candidate.step.interval;
  }
  const previous = located[candidate.index - 1];
  if (!previous) {
    return false;
  }
  const previousExecutedAt = await clock.store.executedAt(id, stepKey(previous.place));
  if (previousExecutedAt === undefined) {
    return false;
  }
  return clock.now >= previousExecutedAt + candidate.step.interval;
}

export function planWithTransactionId(
  plan: Plan,
  place: StepPlace,
  transactionId: string,
): Plan {
  return {
    rows: plan.rows.map((row, rowIndex) => {
      if (rowIndex !== place.rowIndex) {
        return row;
      }
      if (row.kind === 'deposit' && place.role === 'deposit') {
        return { ...row, step: { ...row.step, transactionId } };
      }
      if (row.kind === 'payout' && place.role === 'transfer' && row.transfer) {
        return { ...row, transfer: { ...row.transfer, transactionId } };
      }
      if (row.kind === 'payout' && place.role === 'withdrawal') {
        return { ...row, withdrawal: { ...row.withdrawal, transactionId } };
      }
      return row;
    }),
  };
}
