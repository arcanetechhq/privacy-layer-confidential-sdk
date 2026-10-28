import { expect, it } from 'vitest';
import {
  authorizeDeposit,
  compose,
  confirm,
  DepositAuthorizationMismatchError,
  DepositStepNotDueError,
  insertDeposit,
  isCancelledPlan,
  read,
  runDueSteps,
  submitNextStep,
  unspentNotes,
} from '../../src/index.js';
import {
  SERVICE_ACCOUNT,
  CURRENT_ROOT,
  SOROBAN_AUTHORIZATION,
  INITIAL_TRANSACTION,
  TRANSFER_TRANSACTION,
  notes,
  composeExample,
  depositStep,
  payoutAt,
  transferStep,
  withdrawalStep,
  depositAt,
  presenceForFirst,
  authorizationForStep,
  authorizationFor,
  executedInitialDeposit,
  harness,
  planText,
} from '../support/run-next-step.support.test.js';

it('refuses the proof when Inspect refuses and leaves the Step unblocked', async () => {
  const plan = composeExample();
  const service = harness();
  const id = await confirm(plan, authorizationFor(plan), service.dependencies);

  service.setNow(100n);
  service.setPresence(executedInitialDeposit(plan));
  await runDueSteps(service.dependencies);
  service.setNow(107n);
  service.setInspect('refuse');
  await runDueSteps(service.dependencies);

  expect(await isCancelledPlan(id, service.dependencies.store)).toBe(false);
  expect(service.order.slice(-3)).toEqual(['quote', 'proof', 'inspect']);
  expect(transferStep(await read(id, service.dependencies.store))).not.toHaveProperty(
    'transactionId',
  );

  service.setInspect('accept');
  await runDueSteps(service.dependencies);

  expect(transferStep(await read(id, service.dependencies.store)).transactionId).toBe(
    TRANSFER_TRANSACTION,
  );
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
      scalar: 'unspent-scalar-2',
    },
  ]);
});
it('never submits a Blocked Step', async () => {
  const plan = compose(
    {
      recipients: [
        { account: 'bob-account', amount: 30n },
        { account: 'carol-account', amount: 20n },
        { account: 'dave-account', amount: 10n },
        { account: 'erin-account', amount: 15n },
      ],
      freeTokenFloor: 2n,
      standardInterval: 7n,
    },
    notes,
  );
  const service = harness();
  const id = await confirm(plan, authorizationFor(plan), service.dependencies);
  const transfer = payoutAt(plan, 3).transfer;
  const transferInput = transfer?.pinnedInputs[0];
  if (!transfer || !transferInput) {
    throw new Error('expected an intermediate Transfer');
  }
  const earlier = presenceForFirst(plan, 3);

  service.setNow(1000n);
  service.setPresence({
    consumedNullifierHashes: [
      ...earlier.consumedNullifierHashes,
      transferInput.nullifierHash,
    ],
    outputCommitmentsInPoolTree: earlier.outputCommitmentsInPoolTree,
  });
  await runDueSteps(service.dependencies);
  await submitNextStep(id, service.dependencies);

  expect(service.submittedTransactionIds).toEqual([INITIAL_TRANSACTION]);
  expect(
    payoutAt(await read(id, service.dependencies.store), 3).transfer,
  ).not.toHaveProperty('transactionId');

  service.setPresence(presenceForFirst(plan, 3));
  service.setNow(1007n);
  await runDueSteps(service.dependencies);

  expect(
    payoutAt(await read(id, service.dependencies.store), 3).transfer?.transactionId,
  ).toBe(TRANSFER_TRANSACTION);
});
it('quotes a withdrawal from the Payout amount', async () => {
  const plan = composeExample();
  const service = harness();
  const id = await confirm(plan, authorizationFor(plan), service.dependencies);

  // Bob's withdrawal spends one mode 010 note and keeps Free tokens 2. The Payout is 30.
  expect(withdrawalStep(plan).freeTokens).toBe(2n);
  expect(withdrawalStep(plan).pinnedOutputs).toEqual([]);
  expect(payoutAt(plan, 1).amount).toBe(30n);

  service.setNow(10n);
  service.setPresence(presenceForFirst(plan, 1));
  await runDueSteps(service.dependencies);
  service.setNow(17n);
  await runDueSteps(service.dependencies);

  expect(service.quotes.at(-1)).toEqual({
    publicDeposit: 0n,
    valueMoved: 2n,
    publicWithdrawal: 30n,
  });
  expect(withdrawalStep(await read(id, service.dependencies.store)).transactionId).toBe(
    TRANSFER_TRANSACTION,
  );
  const unspent = await unspentNotes(id, service.dependencies.store);
  const lastUnspent = unspent.at(-1);
  expect(lastUnspent).toEqual({
    planId: id,
    step: { rowIndex: 1, role: 'withdrawal' },
    amount: 1n,
    accumulator: '',
    scalar: 'unspent-scalar-transfer',
  });
});
it('measures the first interval from confirmation', async () => {
  const plan = composeExample();
  const service = harness();
  service.setNow(50n);
  service.setSubmitOk(false);
  const id = await confirm(plan, authorizationFor(plan), service.dependencies);
  service.setSubmitOk(true);
  await authorizeDeposit(id, authorizationFor(plan), service.dependencies);

  service.setNow(49n);
  await runDueSteps(service.dependencies);
  expect(service.submittedTransactionIds).toEqual([INITIAL_TRANSACTION]);

  await submitNextStep(id, service.dependencies);
  expect(depositStep(await read(id, service.dependencies.store)).transactionId).toBe(
    TRANSFER_TRANSACTION,
  );
});
it('does not submit a Deposit authorization after the current root changes', async () => {
  const plan = insertDeposit(composeExample(), 2, {
    freeTokenFloor: 2n,
    standardInterval: 7n,
    notes,
  });
  const service = harness();
  const id = await confirm(plan, authorizationFor(plan), service.dependencies);
  service.setPresence(presenceForFirst(plan, 2));
  service.setNow(0n);
  await runDueSteps(service.dependencies);
  const later = authorizationForStep(
    depositAt(plan, 2).step,
    CURRENT_ROOT,
    'later-deposit-authorization',
  );
  await authorizeDeposit(id, later, service.dependencies);

  service.setRoot('next-root');
  service.setNow(7n);
  await runDueSteps(service.dependencies);
  await submitNextStep(id, service.dependencies);

  expect(
    depositAt(await read(id, service.dependencies.store), 2).step,
  ).not.toHaveProperty('transactionId');
  expect(service.submittedAuthorizations).toEqual([SOROBAN_AUTHORIZATION]);
});
it('proves a later Deposit only once that Step is due', async () => {
  const plan = insertDeposit(composeExample(), 2, {
    freeTokenFloor: 2n,
    standardInterval: 7n,
    notes,
  });
  const service = harness();
  const id = await confirm(plan, authorizationFor(plan), service.dependencies);

  expect(service.quotes).toEqual([
    { publicDeposit: 68n, valueMoved: 68n, publicWithdrawal: 0n },
  ]);
  expect(service.proofRoots).toEqual([CURRENT_ROOT]);
  expect(
    depositAt(await read(id, service.dependencies.store), 2).step,
  ).not.toHaveProperty('transactionId');

  await expect(
    authorizeDeposit(id, authorizationFor(plan), service.dependencies),
  ).rejects.toThrow(DepositStepNotDueError);
  expect(service.proofRoots).toEqual([CURRENT_ROOT]);
});
it('refuses a Deposit Step until its authorization matches the current root', async () => {
  const plan = insertDeposit(composeExample(), 2, {
    freeTokenFloor: 2n,
    standardInterval: 7n,
    notes,
  });
  const pinnedBefore = depositAt(plan, 2).step.pinnedOutputs.map(
    (note) => note.commitment,
  );
  const service = harness();
  const id = await confirm(plan, authorizationFor(plan), service.dependencies);

  service.setPresence(presenceForFirst(plan, 2));
  service.setNow(0n);
  await runDueSteps(service.dependencies);
  service.setNow(7n);
  await runDueSteps(service.dependencies);
  await submitNextStep(id, service.dependencies);

  expect(service.submittedTransactionIds).toEqual([INITIAL_TRANSACTION]);
  expect(
    depositAt(await read(id, service.dependencies.store), 2).step,
  ).not.toHaveProperty('transactionId');

  await expect(
    authorizeDeposit(
      id,
      authorizationForStep(
        depositAt(plan, 2).step,
        'stale-root',
        'stale-authorization',
      ),
      service.dependencies,
    ),
  ).rejects.toThrow(DepositAuthorizationMismatchError);
  expect(planText(await read(id, service.dependencies.store))).not.toContain(
    'stale-authorization',
  );

  service.setNow(0n);
  service.setScalars(['later-unspent-scalar']);
  const later = authorizationForStep(
    depositAt(plan, 2).step,
    CURRENT_ROOT,
    'later-deposit-authorization',
  );
  await authorizeDeposit(id, later, service.dependencies);

  expect(service.quotes.at(-1)).toEqual({
    publicDeposit: 2n,
    valueMoved: 36n,
    publicWithdrawal: 0n,
  });
  expect(service.proofRoots.at(-1)).toBe(CURRENT_ROOT);
  expect(planText(await read(id, service.dependencies.store))).not.toContain(
    'later-deposit-authorization',
  );
  expect(await read(id, service.dependencies.store)).not.toHaveProperty(
    'executionMaterial',
  );
  expect(
    depositAt(await read(id, service.dependencies.store), 2).step.pinnedOutputs.map(
      (note) => note.commitment,
    ),
  ).toEqual(pinnedBefore);

  await runDueSteps(service.dependencies);
  expect(
    depositAt(await read(id, service.dependencies.store), 2).step,
  ).not.toHaveProperty('transactionId');

  const proofsAfterAuthorization = service.proofRoots.length;
  await submitNextStep(id, service.dependencies);
  expect(service.proofRoots).toHaveLength(proofsAfterAuthorization);

  expect(
    depositAt(await read(id, service.dependencies.store), 2).step.transactionId,
  ).toBe(TRANSFER_TRANSACTION);
  expect(service.submittedAuthorizations.at(-1)).toBe('later-deposit-authorization');
  expect(service.envelopeSigners.at(-1)).toBe(SERVICE_ACCOUNT);
  const unspent = await unspentNotes(id, service.dependencies.store);
  const lastUnspent = unspent.at(-1);
  expect(lastUnspent).toEqual({
    planId: id,
    step: { rowIndex: 2, role: 'deposit' },
    amount: 1n,
    accumulator: '',
    scalar: 'later-unspent-scalar',
  });
});
it('does not submit or cancel when confirmation is quoted above Free tokens', async () => {
  const plan = composeExample();
  const service = harness();
  service.setQuote({ amount: 3n, collector: 'other-collector' });
  const id = await confirm(plan, authorizationFor(plan), service.dependencies);

  expect(service.order).toEqual(['quote']);
  expect(service.submittedTransactionIds).toEqual([]);
  expect(await isCancelledPlan(id, service.dependencies.store)).toBe(false);
  expect(depositStep(await read(id, service.dependencies.store))).not.toHaveProperty(
    'transactionId',
  );
  expect(await unspentNotes(id, service.dependencies.store)).toEqual([]);

  service.setQuote({ amount: 1n, collector: 'fee-collector' });
  await authorizeDeposit(id, authorizationFor(plan), service.dependencies);
  await runDueSteps(service.dependencies);

  expect(await isCancelledPlan(id, service.dependencies.store)).toBe(false);
  expect(depositStep(await read(id, service.dependencies.store)).transactionId).toBe(
    INITIAL_TRANSACTION,
  );
  expect(service.feeNotes).toEqual([
    { amount: 1n, accumulator: '', collector: 'fee-collector' },
  ]);
});
it('does not submit the Initial Deposit when Inspect refuses', async () => {
  const plan = composeExample();
  const service = harness();
  service.setInspect('refuse');
  const id = await confirm(plan, authorizationFor(plan), service.dependencies);

  expect(service.order).toEqual(['quote', 'proof', 'inspect']);
  expect(await isCancelledPlan(id, service.dependencies.store)).toBe(false);
  expect(depositStep(await read(id, service.dependencies.store))).not.toHaveProperty(
    'transactionId',
  );
  expect(await unspentNotes(id, service.dependencies.store)).toEqual([]);

  service.setInspect('accept');
  await authorizeDeposit(id, authorizationFor(plan), service.dependencies);
  await runDueSteps(service.dependencies);

  expect(await isCancelledPlan(id, service.dependencies.store)).toBe(false);
  expect(depositStep(await read(id, service.dependencies.store)).transactionId).toBe(
    INITIAL_TRANSACTION,
  );
});
