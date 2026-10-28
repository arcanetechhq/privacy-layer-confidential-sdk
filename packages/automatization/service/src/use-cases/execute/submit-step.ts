import { rememberUnspentNote, submitPreparedDeposit } from './prepared-submit.js';
import {
  isBlockedStep,
  isExecutedStep,
  type PinnedNotePresence,
  type Plan,
} from '@arcanetech/privacy-sdk-automatization-plan';
import { maskedOutputs } from '../../domain/notes/index.js';
import {
  earliestOpenStep,
  intervalElapsed,
  locateSteps,
  planWithTransactionId,
  quoteRequest,
  stampExecuted,
  type LocatedStep,
} from '../../domain/steps/index.js';
import type {
  FeeQuote,
  QuoteGuardStore,
  TransactInvocation,
  UnspentNoteShape,
} from '../../ports/index.js';
import type { StepDependencies, StepPorts } from './dependencies.js';

function initialDepositExecuted(
  located: readonly LocatedStep[],
  presence: PinnedNotePresence,
): boolean {
  const initial = located[0];
  if (!initial) {
    return false;
  }
  return isExecutedStep(initial.step, presence);
}

export async function assessQuote(input: {
  id: string;
  candidate: LocatedStep;
  located: readonly LocatedStep[];
  presence: PinnedNotePresence;
  dependencies: Pick<StepPorts, 'feeQuotes'> & { readonly store: QuoteGuardStore };
}): Promise<FeeQuote | undefined> {
  const quote = await input.dependencies.feeQuotes.quote(
    quoteRequest(
      input.candidate.step,
      input.candidate.publicDeposit,
      input.candidate.publicWithdrawal,
    ),
  );
  if (quote.amount > input.candidate.step.freeTokens) {
    return undefined;
  }
  const accepted = await input.dependencies.store.acceptedInitialQuote(input.id);
  if (
    accepted !== undefined &&
    !initialDepositExecuted(input.located, input.presence) &&
    !sameFeeQuote(quote, accepted)
  ) {
    await input.dependencies.store.cancel(input.id);
    return undefined;
  }
  return quote;
}

function sameFeeQuote(left: FeeQuote, right: FeeQuote): boolean {
  return left.amount === right.amount && left.collector === right.collector;
}

export async function rememberAcceptedQuote(
  store: QuoteGuardStore,
  id: string,
  quote: FeeQuote,
  viewed: {
    readonly located: readonly LocatedStep[];
    readonly presence: PinnedNotePresence;
  },
): Promise<void> {
  if (initialDepositExecuted(viewed.located, viewed.presence)) {
    return;
  }
  await store.recordAcceptedInitialQuote(id, quote);
}

export async function proveCandidate(
  candidate: LocatedStep,
  quote: FeeQuote,
  dependencies: Pick<StepPorts, 'freshScalars' | 'currentRoot' | 'proofs'>,
): Promise<{
  readonly invocation: TransactInvocation;
  readonly unspentNote?: UnspentNoteShape;
}> {
  const masked = await maskedOutputs(candidate.step, quote, dependencies.freshScalars);
  const root = await dependencies.currentRoot.current();
  const invocation = await dependencies.proofs.prove({
    step: candidate.step,
    quote,
    root,
    feeNote: masked.feeNote,
    ...(masked.unspentNote === undefined ? {} : { unspentNote: masked.unspentNote }),
    publicDeposit: candidate.publicDeposit,
    publicWithdrawal: candidate.publicWithdrawal,
    recipient: candidate.recipient,
  });
  if (masked.unspentNote === undefined) {
    return { invocation };
  }
  return { invocation, unspentNote: masked.unspentNote };
}

async function dueQuote(input: {
  id: string;
  dependencies: StepDependencies;
  ignoreInterval: boolean;
}): Promise<
  | {
      plan: Plan;
      candidate: LocatedStep;
      quote: FeeQuote;
    }
  | undefined
> {
  if (await input.dependencies.store.isCancelled(input.id)) {
    return;
  }
  const plan = await input.dependencies.store.read(input.id);
  const presence = await input.dependencies.presence.report();
  const located = locateSteps(plan);
  const clock = {
    store: input.dependencies.store,
    now: await input.dependencies.clock.now(),
  };
  await stampExecuted(input.id, located, presence, clock);
  const candidate = earliestOpenStep(located, presence);
  if (
    !candidate ||
    isBlockedStep(candidate.step, presence) ||
    candidate.step.transactionId !== undefined ||
    (!input.ignoreInterval &&
      !(await intervalElapsed(input.id, located, candidate, clock)))
  ) {
    return;
  }
  const quote = await assessQuote({
    id: input.id,
    candidate,
    located,
    presence,
    dependencies: input.dependencies,
  });
  if (quote === undefined) {
    return;
  }
  return { plan, candidate, quote };
}

export async function submitCandidate(
  id: string,
  dependencies: StepDependencies,
  ignoreInterval: boolean,
): Promise<void> {
  const due = await dueQuote({ id, dependencies, ignoreInterval });
  if (due === undefined) {
    return;
  }
  if (due.candidate.place.role === 'deposit') {
    await submitPreparedDeposit({
      id,
      plan: due.plan,
      candidate: due.candidate,
      quote: due.quote,
      dependencies,
    });
    return;
  }
  await submitTransfer({
    id,
    plan: due.plan,
    candidate: due.candidate,
    quote: due.quote,
    dependencies,
  });
}

async function submitTransfer(input: {
  id: string;
  plan: Plan;
  candidate: LocatedStep;
  quote: FeeQuote;
  dependencies: StepDependencies;
}): Promise<void> {
  const proved = await proveCandidate(input.candidate, input.quote, input.dependencies);
  if ((await input.dependencies.inspection.inspect(proved.invocation)) === 'refuse') {
    return;
  }
  const result = await input.dependencies.pool.submit({
    envelopeSigner: input.dependencies.serviceAccount,
    invocation: proved.invocation,
  });
  if (!result.ok) {
    return;
  }
  await input.dependencies.store.savePlan(
    input.id,
    planWithTransactionId(input.plan, input.candidate.place, result.transactionId),
  );
  await rememberUnspentNote(
    input.dependencies.store,
    input.id,
    input.candidate.place,
    proved.unspentNote,
  );
}
