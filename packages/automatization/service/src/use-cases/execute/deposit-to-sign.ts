import type { Plan } from '@arcanetech/privacy-sdk-automatization-plan';
import { DepositRefusedError, DepositStepNotDueError } from '../../errors/index.js';
import {
  earliestOpenStep,
  locateSteps,
  quoteRequest,
  type LocatedStep,
} from '../../domain/steps/index.js';
import type {
  DepositSigning,
  PlanDocuments,
  TransactInvocation,
} from '../../ports/index.js';
import type { StepPorts } from './dependencies.js';
import { proveCandidate } from './submit-step.js';

export interface DepositToSign {
  readonly invocation: TransactInvocation;
  readonly authEntries: readonly string[];
}

export type DepositToSignDependencies = Pick<
  StepPorts,
  'currentRoot' | 'feeQuotes' | 'freshScalars' | 'inspection' | 'presence' | 'proofs'
> & {
  readonly depositSigning: DepositSigning;
  readonly store: Pick<PlanDocuments, 'read'>;
};

async function dueDeposit(
  plan: Plan | string,
  dependencies: DepositToSignDependencies,
): Promise<LocatedStep> {
  if (typeof plan !== 'string') {
    const initial = locateSteps(plan)[0];
    if (initial?.place.role !== 'deposit') {
      throw new DepositStepNotDueError();
    }
    return initial;
  }
  const located = locateSteps(await dependencies.store.read(plan));
  const candidate = earliestOpenStep(located, await dependencies.presence.report());
  if (
    candidate === undefined ||
    candidate.place.role !== 'deposit' ||
    candidate.step.transactionId !== undefined
  ) {
    throw new DepositStepNotDueError();
  }
  return candidate;
}

export async function depositToSign(
  plan: Plan | string,
  dependencies: DepositToSignDependencies,
): Promise<DepositToSign> {
  const candidate = await dueDeposit(plan, dependencies);
  const quote = await dependencies.feeQuotes.quote(
    quoteRequest(candidate.step, candidate.publicDeposit, candidate.publicWithdrawal),
  );
  if (quote.amount > candidate.step.freeTokens) {
    throw new DepositRefusedError(
      `Fee quote ${quote.amount.toString()} exceeds this Step's Free tokens ${candidate.step.freeTokens.toString()}`,
    );
  }
  const { invocation } = await proveCandidate(candidate, quote, dependencies);
  if ((await dependencies.inspection.inspect(invocation)) === 'refuse') {
    await dependencies.depositSigning.authEntries(invocation);
    throw new DepositRefusedError();
  }
  return {
    invocation,
    authEntries: await dependencies.depositSigning.authEntries(invocation),
  };
}
