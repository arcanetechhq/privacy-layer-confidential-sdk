import { expect, it } from 'vitest';
import {
  authorizeDeposit,
  confirm,
  DepositStepNotDueError,
  isCancelledPlan,
  read,
  runDueSteps,
  submitNextStep,
  unspentNotes,
  type StepDependencies,
} from '../../src/index.js';
import {
  SERVICE_ACCOUNT,
  CURRENT_ROOT,
  SOROBAN_AUTHORIZATION,
  INITIAL_TRANSACTION,
  TRANSFER_TRANSACTION,
  composeExample,
  depositStep,
  transferStep,
  authorizationForStep,
  authorizationFor,
  executedInitialDeposit,
  harness,
  planText,
} from '../support/run-next-step.support.test.js';

it('submits the next Step after the previous one is executed and the interval has elapsed', async () => {
  const plan = composeExample();
  const pinnedBefore = transferStep(plan).pinnedOutputs.map((note) => note.commitment);
  const service = harness();
  const id = await confirm(plan, authorizationFor(plan), service.dependencies);

  // Bob's transfer keeps Free tokens 2 and pins a 70 Remainder. The fee is 1.
  expect(transferStep(plan).freeTokens).toBe(2n);
  expect(transferStep(plan).pinnedOutputs).toEqual([]);
  expect(transferStep(plan).interval).toBe(7n);

  service.setNow(100n);
  service.setPresence(executedInitialDeposit(plan));
  await runDueSteps(service.dependencies satisfies StepDependencies);
  service.setNow(106n);
  await runDueSteps(service.dependencies);
  expect(service.submittedTransactionIds).toEqual([INITIAL_TRANSACTION]);
  expect(transferStep(await read(id, service.dependencies.store))).not.toHaveProperty(
    'transactionId',
  );

  service.setNow(107n);
  await runDueSteps(service.dependencies);

  expect(service.quotes).toEqual([
    { publicDeposit: 68n, valueMoved: 68n, publicWithdrawal: 0n },
    { publicDeposit: 0n, valueMoved: 2n, publicWithdrawal: 30n },
  ]);
  expect(service.feeNotes).toEqual([
    { amount: 1n, accumulator: '', collector: 'fee-collector' },
    { amount: 1n, accumulator: '', collector: 'fee-collector' },
  ]);
  expect(service.order).toEqual([
    'quote',
    'proof',
    'inspect',
    'submit',
    'quote',
    'proof',
    'inspect',
    'submit',
  ]);
  expect(service.submittedTransactionIds).toEqual([
    INITIAL_TRANSACTION,
    TRANSFER_TRANSACTION,
  ]);
  expect(transferStep(await read(id, service.dependencies.store)).transactionId).toBe(
    TRANSFER_TRANSACTION,
  );
  expect(
    transferStep(await read(id, service.dependencies.store)).pinnedOutputs.map(
      (note) => note.commitment,
    ),
  ).toEqual(pinnedBefore);
  expect(
    transferStep(await read(id, service.dependencies.store)).pinnedOutputs,
  ).toEqual([]);
  expect(await unspentNotes(id, service.dependencies.store)).toEqual([
    {
      planId: id,
      step: { rowIndex: 0, role: 'deposit' },
      amount: 1n,
      accumulator: '',
      scalar: 'unspent-scalar-initial',
    },
    {
      planId: id,
      step: { rowIndex: 1, role: 'withdrawal' },
      amount: 1n,
      accumulator: '',
      scalar: 'unspent-scalar-transfer',
    },
  ]);
  const unspent = await unspentNotes(id, service.dependencies.store);
  expect(unspent.map((note) => note.scalar)).not.toContain('fee-collector');
  for (const note of service.feeNotes) {
    expect(note).not.toHaveProperty('scalar');
  }
  expect(await read(id, service.dependencies.store)).not.toHaveProperty(
    'executionMaterial',
  );
  expect(await read(id, service.dependencies.store)).not.toHaveProperty(
    'serviceScalar',
  );
  expect(service.envelopeSigners).toEqual([SERVICE_ACCOUNT, SERVICE_ACCOUNT]);
});
it('does not submit a Step again while it is submitted and not executed', async () => {
  const plan = composeExample();
  const service = harness();
  const id = await confirm(plan, authorizationFor(plan), service.dependencies);

  service.setNow(1000n);
  await runDueSteps(service.dependencies);
  await submitNextStep(id, service.dependencies);

  expect(service.submittedTransactionIds).toEqual([INITIAL_TRANSACTION]);
  expect(service.order).toEqual(['quote', 'proof', 'inspect', 'submit']);
  expect(depositStep(await read(id, service.dependencies.store)).transactionId).toBe(
    INITIAL_TRANSACTION,
  );
  expect(transferStep(await read(id, service.dependencies.store))).not.toHaveProperty(
    'transactionId',
  );
  expect(await isCancelledPlan(id, service.dependencies.store)).toBe(false);
});
it('lets a manual request submit before the interval once the previous Step is executed', async () => {
  const plan = composeExample();
  const service = harness();
  const id = await confirm(plan, authorizationFor(plan), service.dependencies);

  service.setNow(100n);
  service.setPresence(executedInitialDeposit(plan));
  await submitNextStep(id, service.dependencies);

  expect(transferStep(await read(id, service.dependencies.store)).transactionId).toBe(
    TRANSFER_TRANSACTION,
  );
  expect(service.order).toEqual([
    'quote',
    'proof',
    'inspect',
    'submit',
    'quote',
    'proof',
    'inspect',
    'submit',
  ]);
  expect(service.submittedAuthorizations[1]).toBeUndefined();
});
it('does not let a manual request submit when the Fee quote is above Free tokens', async () => {
  const plan = composeExample();
  const service = harness();
  const id = await confirm(plan, authorizationFor(plan), service.dependencies);

  service.setNow(100n);
  service.setPresence(executedInitialDeposit(plan));
  service.setQuote({ amount: 3n, collector: 'fee-collector' });
  await submitNextStep(id, service.dependencies);

  expect(await isCancelledPlan(id, service.dependencies.store)).toBe(false);
  expect(transferStep(await read(id, service.dependencies.store))).not.toHaveProperty(
    'transactionId',
  );
  expect(service.submittedTransactionIds).toEqual([INITIAL_TRANSACTION]);

  service.setQuote({ amount: 1n, collector: 'fee-collector' });
  await submitNextStep(id, service.dependencies);

  expect(await isCancelledPlan(id, service.dependencies.store)).toBe(false);
  expect(transferStep(await read(id, service.dependencies.store)).transactionId).toBe(
    TRANSFER_TRANSACTION,
  );
});
it('does not let a manual request submit when Inspect refuses', async () => {
  const plan = composeExample();
  const service = harness();
  const id = await confirm(plan, authorizationFor(plan), service.dependencies);

  service.setNow(100n);
  service.setPresence(executedInitialDeposit(plan));
  service.setInspect('refuse');
  await submitNextStep(id, service.dependencies);

  expect(await isCancelledPlan(id, service.dependencies.store)).toBe(false);
  expect(transferStep(await read(id, service.dependencies.store))).not.toHaveProperty(
    'transactionId',
  );
  expect(service.submittedTransactionIds).toEqual([INITIAL_TRANSACTION]);

  service.setInspect('accept');
  await submitNextStep(id, service.dependencies);

  expect(await isCancelledPlan(id, service.dependencies.store)).toBe(false);
  expect(transferStep(await read(id, service.dependencies.store)).transactionId).toBe(
    TRANSFER_TRANSACTION,
  );
});
it('stores no Unspent note when the fee equals Free tokens and keeps pinned commitments', async () => {
  const plan = composeExample();
  const pinnedBefore = transferStep(plan).pinnedOutputs.map((note) => note.commitment);
  const service = harness();
  const id = await confirm(plan, authorizationFor(plan), service.dependencies);

  service.setNow(100n);
  service.setPresence(executedInitialDeposit(plan));
  await runDueSteps(service.dependencies);
  service.setNow(107n);
  service.setQuote({ amount: 2n, collector: 'other-collector' });
  await runDueSteps(service.dependencies);

  expect(await isCancelledPlan(id, service.dependencies.store)).toBe(false);
  expect(service.feeNotes.at(-1)).toEqual({
    amount: 2n,
    accumulator: '',
    collector: 'other-collector',
  });
  expect(service.order.slice(-4)).toEqual(['quote', 'proof', 'inspect', 'submit']);
  expect(
    transferStep(await read(id, service.dependencies.store)).pinnedOutputs.map(
      (note) => note.commitment,
    ),
  ).toEqual(pinnedBefore);
  expect(
    transferStep(await read(id, service.dependencies.store)).pinnedOutputs.some(
      (note) => note.plaintext.amount === 2n,
    ),
  ).toBe(false);
  expect(await unspentNotes(id, service.dependencies.store)).toEqual([
    {
      planId: id,
      step: { rowIndex: 0, role: 'deposit' },
      amount: 1n,
      accumulator: '',
      scalar: 'unspent-scalar-initial',
    },
  ]);
});
it('does not submit or cancel when the fee is above Free tokens, and a later quote can submit', async () => {
  const plan = composeExample();
  const service = harness();
  const id = await confirm(plan, authorizationFor(plan), service.dependencies);

  service.setNow(100n);
  service.setPresence(executedInitialDeposit(plan));
  await runDueSteps(service.dependencies);
  service.setNow(107n);
  service.setQuote({ amount: 3n, collector: 'fee-collector' });
  await runDueSteps(service.dependencies);

  expect(await isCancelledPlan(id, service.dependencies.store)).toBe(false);
  expect(service.submittedTransactionIds).toEqual([INITIAL_TRANSACTION]);
  expect(transferStep(await read(id, service.dependencies.store))).not.toHaveProperty(
    'transactionId',
  );
  expect(service.feeNotes).toEqual([
    { amount: 1n, accumulator: '', collector: 'fee-collector' },
  ]);

  service.setQuote({ amount: 1n, collector: 'fee-collector' });
  await runDueSteps(service.dependencies);

  expect(await isCancelledPlan(id, service.dependencies.store)).toBe(false);
  expect(transferStep(await read(id, service.dependencies.store)).transactionId).toBe(
    TRANSFER_TRANSACTION,
  );
});
it('cancels the Plan when the fee amount changes before the Initial Deposit is executed', async () => {
  const plan = composeExample();
  const service = harness();
  service.setSubmitOk(false);
  const id = await confirm(plan, authorizationFor(plan), service.dependencies);
  service.setSubmitOk(true);

  const renewed = authorizationForStep(
    depositStep(plan),
    CURRENT_ROOT,
    'renewed-authorization',
  );
  await authorizeDeposit(id, renewed, service.dependencies);
  service.setQuote({ amount: 2n, collector: 'fee-collector' });
  await runDueSteps(service.dependencies);

  expect(await isCancelledPlan(id, service.dependencies.store)).toBe(true);
  expect(service.submittedAuthorizations).toEqual([SOROBAN_AUTHORIZATION]);
  expect(depositStep(await read(id, service.dependencies.store))).not.toHaveProperty(
    'transactionId',
  );
  expect(planText(await read(id, service.dependencies.store))).not.toContain(
    'renewed-authorization',
  );
  const reread = await read(id, service.dependencies.store);
  expect(reread.rows).toHaveLength(plan.rows.length);

  service.setQuote({ amount: 1n, collector: 'fee-collector' });
  await runDueSteps(service.dependencies);
  await submitNextStep(id, service.dependencies);
  expect(service.submittedAuthorizations).toEqual([SOROBAN_AUTHORIZATION]);
  await expect(authorizeDeposit(id, renewed, service.dependencies)).rejects.toThrow(
    DepositStepNotDueError,
  );
});
it('cancels the Plan when the collector changes before the Initial Deposit is executed', async () => {
  const plan = composeExample();
  const service = harness();
  service.setSubmitOk(false);
  const id = await confirm(plan, authorizationFor(plan), service.dependencies);
  service.setSubmitOk(true);
  service.setQuote({ amount: 1n, collector: 'other-collector' });

  await authorizeDeposit(id, authorizationFor(plan), service.dependencies);

  expect(await isCancelledPlan(id, service.dependencies.store)).toBe(true);
  expect(service.proofRoots).toEqual([CURRENT_ROOT]);
  expect(service.submittedAuthorizations).toEqual([SOROBAN_AUTHORIZATION]);
  await submitNextStep(id, service.dependencies);
  expect(service.submittedTransactionIds).toEqual([INITIAL_TRANSACTION]);
});
it('does not cancel when a quote above Free tokens differs before the Initial Deposit is executed', async () => {
  const plan = composeExample();
  const service = harness();
  service.setSubmitOk(false);
  const id = await confirm(plan, authorizationFor(plan), service.dependencies);
  service.setSubmitOk(true);
  service.setQuote({ amount: 3n, collector: 'other-collector' });
  await runDueSteps(service.dependencies);

  expect(await isCancelledPlan(id, service.dependencies.store)).toBe(false);
  expect(service.feeNotes.map((note) => note.amount)).toEqual([1n]);
  expect(depositStep(await read(id, service.dependencies.store))).not.toHaveProperty(
    'transactionId',
  );

  service.setQuote({ amount: 1n, collector: 'fee-collector' });
  await authorizeDeposit(id, authorizationFor(plan), service.dependencies);
  await runDueSteps(service.dependencies);

  expect(await isCancelledPlan(id, service.dependencies.store)).toBe(false);
  expect(depositStep(await read(id, service.dependencies.store)).transactionId).toBe(
    TRANSFER_TRANSACTION,
  );
});
