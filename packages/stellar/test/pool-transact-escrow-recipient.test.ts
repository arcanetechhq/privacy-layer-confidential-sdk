import { describe, expect, it, vi } from 'vitest';
import type { PoolTransactClient } from '../src/transact/pool/types.js';
import { submitPoolTransact } from '../src/transact/submit/pool-transact.js';
import type { StellarTransactEnvironment } from '../src/transact/environment/types.js';

vi.mock('../src/transact/submit/ttl-preflight.js', () => ({
  runTtlPreflight: vi.fn(async () => undefined),
}));

vi.mock('../src/transact/submit/zk-config-ttl.js', () => ({
  extendZkConfigTtlIfNeeded: vi.fn(async () => undefined),
}));

const SIGNATURE_HEX = 'ab'.repeat(64);

function environmentStub(): StellarTransactEnvironment {
  return {
    network: {
      id: 'testnet',
      rpcUrl: 'https://example.invalid',
      networkPassphrase: 'Test SDF Network ; September 2015',
      poolContract: 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
      registryContract: 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
      applicationId: '11111111-1111-4111-8111-111111111111',
    },
    kyt: {
      apiBaseUrl: 'https://kyt.invalid',
      kytPassageRegistryContract:
        'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
    },
  };
}

async function captureTransactArgs() {
  let captured: Parameters<PoolTransactClient['transact']>[0] | undefined;
  const contractClient: PoolTransactClient = {
    get_merkle_root: async () => ({ result: Buffer.alloc(32) }),
    get_commitment_count: async () => ({ result: 0 }),
    get_leaf_ephemeral: async () => ({
      result: { x: Buffer.alloc(32), y: Buffer.alloc(32) },
    }),
    is_nulifier_hash_consumed: async () => ({ result: false }),
    public_output: async () => ({
      signAndSend: async () => ({ sendTransactionResponse: { hash: 'hash' } }),
    }),
    transact: async (parameters) => {
      captured = parameters;
      return {
        signAndSend: async () => ({
          sendTransactionResponse: { hash: 'hash' },
        }),
      };
    },
  };
  await submitPoolTransact({
    contractClient,
    contractId: 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
    from: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
    nonce: 0n,
    proofHex: 'aa',
    publicHex: 'bb',
    approval: {
      status: 'approved',
      passageId: 'cc'.repeat(32),
      signature: SIGNATURE_HEX,
      expiresAtLedger: 1,
    },
    networkPassphrase: 'Test SDF Network ; September 2015',
    sorobanRpcUrl: 'https://example.invalid',
    transactEnvironment: environmentStub(),
  });
  return captured;
}

describe('submitPoolTransact six-argument transact', () => {
  it('invokes transact without an independent escrow_recipient argument', async () => {
    const args = await captureTransactArgs();
    expect(args).toBeDefined();
    expect(Object.hasOwn(args ?? {}, 'escrow_recipient')).toBe(false);
    expect(Object.hasOwn(args ?? {}, 'onboarding')).toBe(false);
    expect(args?.from).toBe('GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF');
    expect(args).toEqual(
      expect.objectContaining({
        nonce: 0n,
        proof_bytes: expect.any(Buffer),
        pub_signals_bytes: expect.any(Buffer),
        ciphertext_bytes: expect.any(Buffer),
        kyt_authorization: expect.objectContaining({
          expiration_ledger: 1,
        }),
      }),
    );
  });
});
