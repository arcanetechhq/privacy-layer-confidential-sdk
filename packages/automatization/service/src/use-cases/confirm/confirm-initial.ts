import type {
  Deposit,
  PinnedNote,
  Plan,
  Step,
} from '@arcanetech/privacy-sdk-automatization-plan';
import { DepositAuthorizationMismatchError } from '../../errors/index.js';
import { maskedOutputs, sameInvocation } from '../../domain/notes/index.js';
import type {
  ConfirmStore,
  DepositAuthorization,
  FeeQuote,
  PlanConfirmation,
  TransactInvocation,
} from '../../ports/index.js';
import type { ConfirmDependencies } from './dependencies.js';

function copyNote(note: PinnedNote): PinnedNote {
  return {
    plaintext: {
      amount: note.plaintext.amount,
      accumulator: note.plaintext.accumulator,
    },
    commitment: note.commitment,
    nullifierHash: note.nullifierHash,
  };
}

function copyStep(step: Step, transactionId?: string): Step {
  return {
    freeTokens: step.freeTokens,
    interval: step.interval,
    pinnedInputs: step.pinnedInputs.map((note) => copyNote(note)),
    pinnedOutputs: step.pinnedOutputs.map((note) => copyNote(note)),
    ...(transactionId === undefined ? {} : { transactionId }),
  };
}

function copyPlan(plan: Plan, initialDepositTransactionId?: string): Plan {
  return {
    rows: plan.rows.map((row, index) => {
      if (row.kind === 'deposit') {
        const transactionId = index === 0 ? initialDepositTransactionId : undefined;
        return { ...row, step: copyStep(row.step, transactionId) };
      }
      return {
        ...row,
        withdrawal: copyStep(row.withdrawal),
        ...(row.transfer === undefined ? {} : { transfer: copyStep(row.transfer) }),
      };
    }),
  };
}

function pinnedOutputCommitments(step: Step): readonly string[] {
  return step.pinnedOutputs.map((note) => note.commitment);
}

function copyAuthorization(authorization: DepositAuthorization): DepositAuthorization {
  return {
    invocation: {
      root: authorization.invocation.root,
      pinnedOutputCommitments: [...authorization.invocation.pinnedOutputCommitments],
    },
    sorobanAuthorization: authorization.sorobanAuthorization,
  };
}

async function proveInitial(
  deposit: Deposit,
  quote: FeeQuote,
  masked: Awaited<ReturnType<typeof maskedOutputs>>,
  dependencies: ConfirmDependencies,
): Promise<TransactInvocation> {
  const root = await dependencies.currentRoot.current();
  const invocation = await dependencies.proofs.prove({
    step: deposit.step,
    quote,
    root,
    feeNote: masked.feeNote,
    ...(masked.unspentNote === undefined ? {} : { unspentNote: masked.unspentNote }),
    publicDeposit: deposit.amount,
    publicWithdrawal: 0n,
    recipient: '',
  });
  const expected: TransactInvocation = {
    root,
    pinnedOutputCommitments: pinnedOutputCommitments(deposit.step),
  };
  if (!sameInvocation(invocation, expected)) {
    throw new DepositAuthorizationMismatchError();
  }
  return invocation;
}

async function saveConfirmedPlan(
  store: ConfirmStore,
  plan: Plan,
  confirmation: PlanConfirmation,
  authorization?: DepositAuthorization,
): Promise<string> {
  const id = await store.allocateId();
  await store.savePlan(id, plan);
  await store.start(id, confirmation.confirmedAt);
  if (confirmation.acceptedInitialQuote !== undefined) {
    await store.recordAcceptedInitialQuote(id, confirmation.acceptedInitialQuote);
  }
  if (authorization !== undefined) {
    await store.addDepositAuthorization(id, copyAuthorization(authorization));
  }
  return id;
}

async function saveSubmitted(
  plan: Plan,
  authorization: DepositAuthorization,
  dependencies: ConfirmDependencies,
  saved: {
    readonly confirmation: PlanConfirmation;
    readonly transactionId: string;
    readonly masked: Awaited<ReturnType<typeof maskedOutputs>>;
  },
): Promise<string> {
  const id = await saveConfirmedPlan(
    dependencies.store,
    copyPlan(plan, saved.transactionId),
    saved.confirmation,
    authorization,
  );
  const unspent = saved.masked.unspentNote;
  if (unspent) {
    await dependencies.store.addUnspentNote(id, {
      planId: id,
      step: { rowIndex: 0, role: 'deposit' },
      amount: unspent.amount,
      accumulator: unspent.accumulator,
      scalar: unspent.scalar,
    });
  }
  return id;
}

export async function confirmOverFreeTokens(input: {
  plan: Plan;
  authorization: DepositAuthorization;
  dependencies: ConfirmDependencies;
  confirmedAt: bigint;
  deposit: Deposit;
}): Promise<string> {
  const composed: TransactInvocation = {
    root: await input.dependencies.currentRoot.current(),
    pinnedOutputCommitments: pinnedOutputCommitments(input.deposit.step),
  };
  if (!sameInvocation(input.authorization.invocation, composed)) {
    throw new DepositAuthorizationMismatchError();
  }
  return saveConfirmedPlan(input.dependencies.store, copyPlan(input.plan), {
    confirmedAt: input.confirmedAt,
  });
}

export async function confirmQuoted(input: {
  plan: Plan;
  authorization: DepositAuthorization;
  dependencies: ConfirmDependencies;
  deposit: Deposit;
  quote: FeeQuote;
  confirmedAt: bigint;
}): Promise<string> {
  const { dependencies } = input;
  const masked = await maskedOutputs(
    input.deposit.step,
    input.quote,
    dependencies.freshScalars,
  );
  const invocation = await proveInitial(
    input.deposit,
    input.quote,
    masked,
    dependencies,
  );
  if (!sameInvocation(input.authorization.invocation, invocation)) {
    throw new DepositAuthorizationMismatchError();
  }
  const confirmation = {
    confirmedAt: input.confirmedAt,
    acceptedInitialQuote: input.quote,
  };
  if ((await dependencies.inspection.inspect(invocation)) === 'refuse') {
    return saveConfirmedPlan(dependencies.store, copyPlan(input.plan), confirmation);
  }
  const result = await dependencies.pool.submit(
    { envelopeSigner: dependencies.serviceAccount, invocation },
    input.authorization,
  );
  if (!result.ok) {
    return saveConfirmedPlan(dependencies.store, copyPlan(input.plan), confirmation);
  }
  return saveSubmitted(input.plan, input.authorization, dependencies, {
    confirmation,
    transactionId: result.transactionId,
    masked,
  });
}
