import type { Plan } from '@arcanetech/privacy-sdk-automatization-plan';
import { sameInvocation } from '../../domain/notes/index.js';
import { planWithTransactionId, type LocatedStep } from '../../domain/steps/index.js';
import type {
  DepositAuthorization,
  FeeQuote,
  StepPlace,
  StepRunStore,
  TransactInvocation,
  UnspentNoteShape,
  UnspentNoteStore,
} from '../../ports/index.js';
import type { StepDependencies } from './dependencies.js';

export async function rememberUnspentNote(
  store: Pick<UnspentNoteStore, 'addUnspentNote'>,
  id: string,
  place: StepPlace,
  unspentNote: UnspentNoteShape | undefined,
): Promise<void> {
  if (unspentNote === undefined) {
    return;
  }
  await store.addUnspentNote(id, {
    planId: id,
    step: place,
    amount: unspentNote.amount,
    accumulator: unspentNote.accumulator,
    scalar: unspentNote.scalar,
  });
}

function sameFeeQuote(left: FeeQuote, right: FeeQuote): boolean {
  return left.amount === right.amount && left.collector === right.collector;
}

async function matchingAuthorization(
  store: StepRunStore,
  id: string,
  invocation: TransactInvocation,
): Promise<DepositAuthorization | undefined> {
  const authorizations = await store.depositAuthorizations(id);
  return authorizations.find((authorization) =>
    sameInvocation(authorization.invocation, invocation),
  );
}

export async function submitPreparedDeposit(input: {
  id: string;
  plan: Plan;
  candidate: LocatedStep;
  quote: FeeQuote;
  dependencies: StepDependencies;
}): Promise<void> {
  const { dependencies } = input;
  const prepared = await dependencies.store.preparedDeposit(
    input.id,
    input.candidate.place,
  );
  if (
    prepared === undefined ||
    !sameFeeQuote(prepared.quote, input.quote) ||
    prepared.invocation.root !== (await dependencies.currentRoot.current())
  ) {
    return;
  }
  const authorization = await matchingAuthorization(
    dependencies.store,
    input.id,
    prepared.invocation,
  );
  if (authorization === undefined) {
    return;
  }
  if ((await dependencies.inspection.inspect(prepared.invocation)) === 'refuse') {
    return;
  }
  const result = await dependencies.pool.submit(
    { envelopeSigner: dependencies.serviceAccount, invocation: prepared.invocation },
    authorization,
  );
  if (!result.ok) {
    return;
  }
  await dependencies.store.savePlan(
    input.id,
    planWithTransactionId(input.plan, input.candidate.place, result.transactionId),
  );
  await rememberUnspentNote(
    dependencies.store,
    input.id,
    input.candidate.place,
    prepared.unspentNote,
  );
}
