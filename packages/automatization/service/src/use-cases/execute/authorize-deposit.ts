import type { Plan } from '@arcanetech/privacy-sdk-automatization-plan';
import {
  DepositAuthorizationMismatchError,
  DepositStepNotDueError,
} from '../../errors/index.js';
import { sameInvocation } from '../../domain/notes/index.js';
import {
  earliestOpenStep,
  locateSteps,
  stampExecuted,
  type LocatedStep,
} from '../../domain/steps/index.js';
import { assessQuote, proveCandidate, rememberAcceptedQuote } from './submit-step.js';
import type { DepositAuthorization, TransactInvocation } from '../../ports/index.js';
import type { AuthorizeDepositDependencies } from './dependencies.js';

async function openDeposit(
  planId: string,
  plan: Plan,
  dependencies: AuthorizeDepositDependencies,
) {
  const presence = await dependencies.presence.report();
  const located = locateSteps(plan);
  await stampExecuted(planId, located, presence, {
    store: dependencies.store,
    now: await dependencies.clock.now(),
  });
  const candidate = earliestOpenStep(located, presence);
  if (
    !candidate ||
    candidate.place.role !== 'deposit' ||
    candidate.step.transactionId !== undefined
  ) {
    throw new DepositStepNotDueError();
  }
  return { presence, located, candidate };
}

async function expectedInvocation(
  candidate: LocatedStep,
  dependencies: AuthorizeDepositDependencies,
): Promise<TransactInvocation> {
  return {
    root: await dependencies.currentRoot.current(),
    pinnedOutputCommitments: candidate.step.pinnedOutputs.map(
      (note) => note.commitment,
    ),
  };
}

export async function authorizeDeposit(
  planId: string,
  authorization: DepositAuthorization,
  dependencies: AuthorizeDepositDependencies,
): Promise<void> {
  if (await dependencies.store.isCancelled(planId)) {
    throw new DepositStepNotDueError();
  }
  const plan = await dependencies.store.read(planId);
  const { presence, located, candidate } = await openDeposit(
    planId,
    plan,
    dependencies,
  );
  const quote = await assessQuote({
    id: planId,
    candidate,
    located,
    presence,
    dependencies,
  });
  if (quote === undefined) {
    return;
  }
  const proved = await proveCandidate(candidate, quote, dependencies);
  const expected = await expectedInvocation(candidate, dependencies);
  if (
    !sameInvocation(proved.invocation, expected) ||
    !sameInvocation(authorization.invocation, proved.invocation)
  ) {
    throw new DepositAuthorizationMismatchError();
  }
  await rememberAcceptedQuote(dependencies.store, planId, quote, { located, presence });
  await dependencies.store.addDepositAuthorization(planId, authorization);
  await dependencies.store.savePreparedDeposit(planId, {
    step: candidate.place,
    quote,
    invocation: proved.invocation,
    ...(proved.unspentNote === undefined ? {} : { unspentNote: proved.unspentNote }),
  });
}
