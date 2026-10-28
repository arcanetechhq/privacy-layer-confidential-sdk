import { confirmOverFreeTokens, confirmQuoted } from './confirm-initial.js';
import {
  underfundedSteps,
  type Deposit,
  type PinnedNote,
  type Plan,
  type Step,
} from '@arcanetech/privacy-sdk-automatization-plan';
import {
  AccumulatorMismatchError,
  UnderfundedPlanError,
  UnownedNoteError,
} from '../../errors/index.js';
import { mode001Accumulator, mode010Accumulator } from '../../domain/notes/index.js';
import {
  locateSteps,
  quoteRequest,
  type LocatedStep,
} from '../../domain/steps/index.js';
import type { DepositAuthorization } from '../../ports/index.js';
import type { ConfirmDependencies } from './dependencies.js';

function initialDeposit(plan: Plan): Deposit {
  const row = plan.rows[0];
  if (row?.kind !== 'deposit') {
    throw new Error('Plan must start with an Initial Deposit');
  }
  return row;
}

function stepsIn(plan: Plan): Step[] {
  return locateSteps(plan).map((located) => located.step);
}

function assertInputAccumulator(
  input: Step['pinnedInputs'][number],
  located: LocatedStep,
): void {
  const accumulator = input.plaintext.accumulator;
  if (accumulator === '') {
    return;
  }
  if (accumulator.startsWith('010:')) {
    if (
      accumulator !== mode010Accumulator(located.recipient, located.publicWithdrawal)
    ) {
      throw new AccumulatorMismatchError();
    }
    return;
  }
  if (accumulator !== mode001Accumulator(located.step.pinnedOutputs)) {
    throw new AccumulatorMismatchError();
  }
}

function assertAccumulators(plan: Plan): void {
  const locatedSteps = locateSteps(plan);
  const spentBy = new Map<string, LocatedStep>();
  for (const located of locatedSteps) {
    for (const input of located.step.pinnedInputs) {
      assertInputAccumulator(input, located);
      spentBy.set(input.commitment, located);
    }
  }
  for (const located of locatedSteps) {
    for (const output of located.step.pinnedOutputs) {
      assertOutputAccumulator(output, spentBy.get(output.commitment));
    }
  }
}

function assertOutputAccumulator(
  output: PinnedNote,
  spender: LocatedStep | undefined,
): void {
  const accumulator = output.plaintext.accumulator;
  if (accumulator === '') {
    if (spender !== undefined) {
      throw new AccumulatorMismatchError();
    }
    return;
  }
  if (!spender) {
    throw new AccumulatorMismatchError();
  }
  const expected = accumulator.startsWith('010:')
    ? mode010Accumulator(spender.recipient, spender.publicWithdrawal)
    : mode001Accumulator(spender.step.pinnedOutputs);
  if (accumulator !== expected) {
    throw new AccumulatorMismatchError();
  }
}

async function assertOwned(
  plan: Plan,
  dependencies: ConfirmDependencies,
): Promise<void> {
  for (const step of stepsIn(plan)) {
    for (const note of [...step.pinnedInputs, ...step.pinnedOutputs]) {
      if (note.plaintext.accumulator === '') {
        continue;
      }
      const owned = await dependencies.noteOwnership.isOwnedByServiceScalar(
        note,
        dependencies.serviceScalar,
      );
      if (!owned) {
        throw new UnownedNoteError();
      }
    }
  }
}

export async function confirm(
  plan: Plan,
  authorization: DepositAuthorization,
  dependencies: ConfirmDependencies,
): Promise<string> {
  const steps = underfundedSteps(plan);
  if (steps.length > 0) {
    throw new UnderfundedPlanError(steps);
  }
  assertAccumulators(plan);
  await assertOwned(plan, dependencies);
  const deposit = initialDeposit(plan);
  const quote = await dependencies.feeQuotes.quote(
    quoteRequest(deposit.step, deposit.amount, 0n),
  );
  const confirmedAt = await dependencies.clock.now();
  if (quote.amount > deposit.step.freeTokens) {
    return confirmOverFreeTokens({
      plan,
      authorization,
      dependencies,
      confirmedAt,
      deposit,
    });
  }
  return confirmQuoted({
    plan,
    authorization,
    dependencies,
    deposit,
    quote,
    confirmedAt,
  });
}
