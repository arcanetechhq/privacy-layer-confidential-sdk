import type { Plan, Row, Step } from './document.js';
import { stepsInRow } from './steps-in-row.js';

interface LeftoverNote {
  readonly commitment: string;
  readonly amount: bigint;
}

function pinnedOutputAmount(step: Step): bigint {
  let total = 0n;
  for (const output of step.pinnedOutputs) {
    total += output.plaintext.amount;
  }
  return total;
}

function leftoverAmount(notes: readonly LeftoverNote[]): bigint {
  let total = 0n;
  for (const note of notes) {
    total += note.amount;
  }
  return total;
}

function depositOnThisStep(row: Row): bigint {
  if (row.kind === 'deposit') {
    return row.amount;
  }
  return 0n;
}

function notesLeftAfter(
  leftovers: readonly LeftoverNote[],
  step: Step,
): LeftoverNote[] {
  const remaining = [...leftovers];
  for (const input of step.pinnedInputs) {
    const match = remaining.findIndex((note) => note.commitment === input.commitment);
    if (match !== -1) {
      remaining.splice(match, 1);
    }
  }
  return [
    ...remaining,
    ...step.pinnedOutputs.map((output) => ({
      commitment: output.commitment,
      amount: output.plaintext.amount,
    })),
  ];
}

function isUnderfunded(
  step: Step,
  leftovers: readonly LeftoverNote[],
  deposit: bigint,
): boolean {
  const needed = pinnedOutputAmount(step) + step.freeTokens;
  return needed > leftoverAmount(leftovers) + deposit;
}

export function underfundedSteps(plan: Plan): readonly Step[] {
  const underfunded: Step[] = [];
  let leftovers: readonly LeftoverNote[] = [];
  for (const row of plan.rows) {
    for (const step of stepsInRow(row)) {
      if (isUnderfunded(step, leftovers, depositOnThisStep(row))) {
        underfunded.push(step);
      }
      leftovers = notesLeftAfter(leftovers, step);
    }
  }
  return underfunded;
}
