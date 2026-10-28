import type { Plan, Row, Step } from '../document/index.js';
import { pinnedOutputAmount } from './pinned-output-amount.js';
import { stepsInRow } from './steps-in-row.js';

interface CreatedNote {
  readonly commitment: string;
  readonly amount: bigint;
}

function depositOnThisRow(row: Row): bigint {
  if (row.kind === 'deposit') {
    return row.amount;
  }
  return 0n;
}

function amountLeftFor(created: readonly CreatedNote[], step: Step): bigint {
  let total = 0n;
  const counted: string[] = [];
  for (const input of step.pinnedInputs) {
    if (counted.includes(input.commitment)) {
      continue;
    }
    counted.push(input.commitment);
    const match = created.find((note) => note.commitment === input.commitment);
    if (match !== undefined) {
      total += match.amount;
    }
  }
  return total;
}

export function underfundedSteps(plan: Plan): readonly Step[] {
  const underfunded: Step[] = [];
  let created: readonly CreatedNote[] = [];
  for (const row of plan.rows) {
    const deposit = depositOnThisRow(row);
    for (const step of stepsInRow(row)) {
      const needed = pinnedOutputAmount(step) + step.freeTokens;
      if (needed > amountLeftFor(created, step) + deposit) {
        underfunded.push(step);
      }
      created = [
        ...created,
        ...step.pinnedOutputs.map((output) => ({
          commitment: output.commitment,
          amount: output.plaintext.amount,
        })),
      ];
    }
  }
  return underfunded;
}
