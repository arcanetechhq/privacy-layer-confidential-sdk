import { afterEach, expect, it, vi } from 'vitest';
import { createKytFeeQuotes } from '../../src/stellar/index.js';
import {
  assertBalance,
  assertPinnedSignals,
} from '../../src/stellar/step-transactions/prepare/checks.js';

const network = {
  rpcUrl: 'https://rpc.example/soroban/rpc',
  networkPassphrase: 'Standalone Network ; February 2017',
  poolContract: 'CPOOL',
  registryContract: 'CREGISTRY',
  applicationId: '101',
};

function quoteResponse(requiredFee: string): Response {
  return Response.json(
    {
      requiredFee,
      feeAsset: 'CASSET',
      feeCollectorPrivateAddress: 'stpl1collector',
      feeRate: '0.001',
    },
    { status: 200, headers: { 'content-type': 'application/json' } },
  );
}

function note(amount: bigint) {
  return {
    plaintext: { amount, accumulator: '' },
    commitment: `c${amount}`,
    nullifierHash: `n${amount}`,
  };
}

function field(value: bigint): string {
  return value.toString(16).padStart(64, '0');
}

afterEach(() => {
  vi.unstubAllGlobals();
});

it('asks the KYT service for a fee quote and caches it per request', async () => {
  const fetchMock = vi.fn(() => Promise.resolve(quoteResponse('7')));
  vi.stubGlobal('fetch', fetchMock);
  const quotes = createKytFeeQuotes({
    network,
    kyt: {
      apiBaseUrl: 'https://kyt.example/',
      passageRegistryContract: 'CKYT',
      inspectAuthorization: 'token',
    },
    assetContract: 'CASSET',
  });
  const request = { publicDeposit: 100n, valueMoved: 130n, publicWithdrawal: 0n };

  const first = await quotes.quote(request);
  const second = await quotes.quote(request);

  expect(first).toEqual({ amount: 7n, collector: 'stpl1collector' });
  expect(second).toEqual(first);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
  expect(url).toBe('https://kyt.example/kyt/fees/quote');
  expect(JSON.parse(String(init.body))).toEqual({
    feeAsset: 'CASSET',
    spendsNotes: true,
    publicDepositAmount: '100',
    transferInstructedAmount: '30',
  });
});

it('rejects a Step whose value does not balance', () => {
  const balanced = {
    publicDeposit: 10n,
    publicWithdrawal: 0n,
    feeAmount: 1n,
    unspentAmount: 2n,
    inputs: [note(5n)],
    outputs: [note(12n)],
  };

  expect(() => assertBalance(balanced)).not.toThrow();
  expect(() => assertBalance({ ...balanced, feeAmount: 2n })).toThrow(
    'Step value does not balance',
  );
});

it('requires proof output signals to match the pinned outputs', () => {
  const publicHex = [field(1n), field(42n)].join('');
  const pinned = [
    {
      plaintext: { amount: 1n, accumulator: '' },
      commitment: '42',
      nullifierHash: 'n',
    },
  ];

  expect(() => assertPinnedSignals(publicHex, 1, pinned)).not.toThrow();
  expect(() => assertPinnedSignals(publicHex, 0, pinned)).toThrow(
    'Proof commitments do not match the pinned outputs',
  );
});
