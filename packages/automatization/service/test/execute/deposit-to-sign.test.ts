import { expect, it } from 'vitest';
import {
  compose,
  confirm,
  createDerivedNoteOwnership,
  createMemoryPlanStore,
  depositToSign,
  DepositRefusedError,
  DepositStepNotDueError,
  systemClock,
  type DepositToSignDependencies,
} from '../../src/index.js';
import { createInMemoryPool, inMemoryNoteDeriver } from '../../src/testing/index.js';

const SERVICE_ACCOUNT = 'GSERVICE';
const SERVICE_SCALAR = 'service-scalar';

function harness(feeAmount = 1n) {
  const store = createMemoryPlanStore();
  const pool = createInMemoryPool(store, {
    feeQuote: { amount: feeAmount, collector: 'collector' },
  });
  const dependencies: DepositToSignDependencies = { ...pool, store };
  const plan = compose(
    {
      recipients: [{ account: 'GRECIPIENT', amount: 10n }],
      freeTokenFloor: 2n,
      standardInterval: 0n,
    },
    inMemoryNoteDeriver,
  );
  return { store, pool, dependencies, plan };
}

it('returns the initial Deposit invocation for an unconfirmed Plan', async () => {
  const { dependencies, plan } = harness();
  const initial = plan.rows[0];
  if (initial?.kind !== 'deposit') {
    throw new Error('Plan must start with a Deposit');
  }

  const signing = await depositToSign(plan, dependencies);

  expect(signing.invocation).toEqual({
    root: 'root:in-memory-pool',
    pinnedOutputCommitments: initial.step.pinnedOutputs.map((note) => note.commitment),
  });
  expect(signing.authEntries).toEqual([]);
});

it('refuses a Deposit whose fee quote exceeds its Free tokens', async () => {
  const { dependencies, plan } = harness(1000n);

  await expect(depositToSign(plan, dependencies)).rejects.toThrow(DepositRefusedError);
});

it('has nothing to sign once the confirmed Plan funded its initial Deposit', async () => {
  const { store, pool, dependencies, plan } = harness();
  const signing = await depositToSign(plan, dependencies);
  const id = await confirm(
    plan,
    { invocation: signing.invocation, sorobanAuthorization: '[]' },
    {
      ...pool,
      serviceAccount: SERVICE_ACCOUNT,
      serviceScalar: SERVICE_SCALAR,
      noteOwnership: createDerivedNoteOwnership(inMemoryNoteDeriver, SERVICE_SCALAR),
      clock: systemClock,
      store,
    },
  );

  await expect(depositToSign(id, dependencies)).rejects.toThrow(DepositStepNotDueError);
});
