import { describe, expect, it, vi } from 'vitest';
import {
  createPreparedOperation,
  createRejectedOperation,
  executionError,
  insufficientStateError,
  invalidIntentError,
  isPreparedOperation,
  missingDependencyError,
  unsupportedDisclosureError,
  type DepositIntent,
  type NetworkAdapter,
  type PolicyAdapter,
  AdapterPrivacyClient,
} from '../src/index.js';

type Address = string;
type Asset = string;

const baseIntent: DepositIntent<Address, Asset, bigint> = {
  from: 'sender',
  to: 'recipient',
  asset: 'USDC',
  amount: 100n,
  disclosure: {
    senderAddress: 'public',
    recipientAddress: 'private',
    assetAddress: 'public',
    amount: 'public',
  },
};

describe('isPreparedOperation', () => {
  it('narrows prepared results', () => {
    const prepared = createPreparedOperation(
      'deposit',
      baseIntent,
      { plan: true },
      async () => ({ ok: true }),
    );
    expect(isPreparedOperation(prepared)).toBe(true);
    expect(prepared.execute).toBeTypeOf('function');
  });

  it('does not narrow rejected results', () => {
    const rejected = createRejectedOperation([
      invalidIntentError('amount', 'bad amount'),
    ]);
    expect(isPreparedOperation(rejected)).toBe(false);
    expect('execute' in rejected).toBe(false);
  });
});

describe('error constructors', () => {
  it('builds stable disclosure errors', () => {
    const error = unsupportedDisclosureError(
      'amount',
      'private',
      ['public'],
      'Amount must be public for this route.',
    );
    expect(error.code).toBe('unsupported_disclosure');
    expect(error.recoverable).toBe(true);
    expect(error.field).toBe('amount');
  });

  it('builds missing dependency errors', () => {
    const error = missingDependencyError('wallet', 'Wallet adapter is required.');
    expect(error.code).toBe('missing_dependency');
    expect(error.dependency).toBe('wallet');
  });

  it('builds execution errors with optional stage', () => {
    const error = executionError('Submission failed.', 'submission');
    expect(error.code).toBe('execution_error');
    expect(error.stage).toBe('submission');
  });

  it('builds insufficient state errors', () => {
    const error = insufficientStateError(
      'missing_private_records',
      'Not enough private records.',
    );
    expect(error.code).toBe('insufficient_state');
  });
});

describe('AdapterPrivacyClient', () => {
  it('rejects invalid amounts before preparation', async () => {
    const client = new AdapterPrivacyClient<
      Address,
      Asset,
      bigint,
      unknown,
      unknown,
      { id: string },
      { ok: boolean }
    >({ network: createNetworkAdapter(), policy: createPolicyAdapter() });

    const result = await client.deposit({
      ...baseIntent,
      amount: 0n,
    });

    expect(result.status).toBe('rejected');
    if (result.status === 'rejected') {
      expect(result.errors[0]?.code).toBe('invalid_intent');
    }
  });

  it('returns prepared operations that execute through the network adapter', async () => {
    const submit = vi.fn(async () => ({ ok: true }));
    const network = createNetworkAdapter({ submit });
    const client = new AdapterPrivacyClient<
      Address,
      Asset,
      bigint,
      unknown,
      unknown,
      { id: string },
      { ok: boolean }
    >({ network, policy: createPolicyAdapter() });

    const result = await client.deposit(baseIntent);
    expect(result.status).toBe('prepared');
    if (result.status !== 'prepared') {
      return;
    }

    const receipt = await result.execute();
    expect(receipt.ok).toBe(true);
    expect(submit).toHaveBeenCalledOnce();
  });

  it('blocks repeated execute calls on prepared operations', async () => {
    const submit = vi.fn(async () => ({ ok: true }));
    const network = createNetworkAdapter({ submit });
    const client = new AdapterPrivacyClient<
      Address,
      Asset,
      bigint,
      unknown,
      unknown,
      { id: string },
      { ok: boolean }
    >({ network, policy: createPolicyAdapter() });

    const result = await client.deposit(baseIntent);
    expect(result.status).toBe('prepared');
    if (result.status !== 'prepared') {
      return;
    }

    await result.execute();
    await expect(result.execute()).rejects.toMatchObject({
      code: 'execution_error',
      stage: 'submission',
    });
    expect(submit).toHaveBeenCalledOnce();
  });

  it('rejects when required adapters are missing', async () => {
    const client = new AdapterPrivacyClient<
      Address,
      Asset,
      bigint,
      unknown,
      unknown,
      { id: string },
      { ok: boolean }
    >({});

    const result = await client.transfer({
      ...baseIntent,
      from: 'private-sender',
      to: 'private-recipient',
    });

    expect(result.status).toBe('rejected');
    if (result.status === 'rejected') {
      expect(result.errors.some((error) => error.code === 'missing_dependency')).toBe(
        true,
      );
    }
  });
});

function createNetworkAdapter(
  overrides: Partial<
    NetworkAdapter<Address, Asset, bigint, { id: string }, { ok: boolean }>
  > = {},
): NetworkAdapter<Address, Asset, bigint, { id: string }, { ok: boolean }> {
  return {
    prepareDeposit: async () => ({ id: 'deposit-plan' }),
    prepareTransfer: async () => ({ id: 'transfer-plan' }),
    prepareWithdraw: async () => ({ id: 'withdraw-plan' }),
    preparePublicWithdraw: async () => ({ id: 'public-withdraw-plan' }),
    submit: async () => ({ ok: true }),
    ...overrides,
  };
}

function createPolicyAdapter(): PolicyAdapter<Address, Asset, bigint> {
  return {
    validateDeposit: async () => [],
    validateTransfer: async () => [],
    validateWithdraw: async () => [],
    validatePublicWithdraw: async () => [],
  };
}
