import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { StellarPreparedOperation } from '../src/types.js';
import type { StellarTransactEnvironment } from '../src/transact/environment/types.js';
import { quoteFeeOutputForPrepared } from '../src/transact/fees/quote-fee-output-for-prepared.js';
import { quoteRequiredFee } from '../src/transact/fees/quote-required-fee.js';

const TOKEN = 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4';
const AMOUNT = 10_000_000n;

vi.mock('../src/transact/fees/quote-required-fee.js', () => ({
  quoteRequiredFee: vi.fn(async () => ({
    requiredFee: 1n,
    feeAsset: TOKEN,
    feeCollectorPrivateAddress: 'stpl1fee',
    feeRate: '0.01',
  })),
}));

describe('return fee quote', () => {
  beforeEach(() => {
    vi.mocked(quoteRequiredFee).mockClear();
  });

  it('quotes a deposit with the deposit fee', async () => {
    await quoteFeeOutputForPrepared({
      prepared: prepared('deposit'),
      environment: {} as StellarTransactEnvironment,
      tokenAddress: TOKEN,
    });

    expect(vi.mocked(quoteRequiredFee).mock.calls[0]?.[0].request).toEqual({
      feeAsset: TOKEN,
      publicDepositAmount: '10000000',
      spendsNotes: false,
    });
  });

  it('quotes a Blend return with the public-withdrawal fee', async () => {
    await quoteFeeOutputForPrepared({
      prepared: prepared('deposit', 'public-withdrawal'),
      environment: {} as StellarTransactEnvironment,
      tokenAddress: TOKEN,
    });

    expect(vi.mocked(quoteRequiredFee).mock.calls[0]?.[0].request).toEqual({
      feeAsset: TOKEN,
      publicWithdrawalAmount: '10000000',
      spendsNotes: true,
    });
  });
});

function prepared(
  kind: 'deposit' | 'withdraw',
  feeSchedule?: string,
): StellarPreparedOperation {
  const intent = {
    from: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
    to: 'stpl1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq',
    asset: 'usdc',
    amount: AMOUNT,
    disclosure: {
      senderAddress: 'private',
      recipientAddress: 'private',
      assetAddress: 'private',
      amount: 'private',
    },
    ...(feeSchedule === undefined ? {} : { feeSchedule }),
  };
  return {
    kind,
    intent,
    consumedRecords: [],
    outputRecords: [],
    submissionPayload: { operationId: 'return-fee', signed: false },
  } as StellarPreparedOperation;
}
