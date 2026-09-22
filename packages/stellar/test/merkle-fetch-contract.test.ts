import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Buffer } from 'buffer';
import { xdr } from '@stellar/stellar-sdk';
import { commitmentBufferToDecimal } from '../src/transact/merkle/encoding.js';
import { fetchAndMergeMerkleState } from '../src/transact/merkle/fetch-contract.js';
import type { PoolMerkleStatePort } from '../src/transact/merkle/state-port.js';
import type { StellarTransactEnvironment } from '../src/transact/environment/types.js';
import type { PoolTransactClient } from '../src/transact/pool/types.js';

const mocks = vi.hoisted(() => ({
  getCommitmentCount: vi.fn(),
  getMerkleRoot: vi.fn(),
  getLedgerEntries: vi.fn(),
}));

async function unusedLeafEphemeral() {
  return { result: { x: Buffer.alloc(32), y: Buffer.alloc(32) } };
}

async function unusedNullifierRead() {
  return { result: false };
}

async function unusedSendPrepared() {
  return { sendTransactionResponse: { hash: 'hash' } };
}

async function unusedTransact() {
  return {
    signAndSend: unusedSendPrepared,
  };
}

function mockPoolClient(): PoolTransactClient {
  return {
    get_commitment_count: mocks.getCommitmentCount,
    get_merkle_root: mocks.getMerkleRoot,
    get_leaf_ephemeral: unusedLeafEphemeral,
    is_nulifier_hash_consumed: unusedNullifierRead,
    transact: unusedTransact,
  };
}

vi.mock('../src/contracts/contract-context.js', () => ({
  readPoolClientFactory: () => mockPoolClient,
}));

vi.mock('../src/rpc/server.js', () => ({
  createStellarRpcServer: () => ({
    getLedgerEntries: mocks.getLedgerEntries,
  }),
}));

const POOL = 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC';
const ROOT = Buffer.alloc(32, 9);

function environment(): StellarTransactEnvironment {
  return {
    network: {
      id: 'testnet',
      rpcUrl: 'https://example.invalid',
      networkPassphrase: 'Test SDF Network ; September 2015',
      poolContract: POOL,
      registryContract: POOL,
      applicationId: '1',
    },
    kyt: {
      apiBaseUrl: 'https://kyt.invalid',
      kytPassageRegistryContract: POOL,
    },
  };
}

function treeLeafKeyScValue(leafIndex: number): xdr.ScVal {
  return xdr.ScVal.scvVec([xdr.ScVal.scvSymbol('Leaf'), xdr.ScVal.scvU32(leafIndex)]);
}

function leafEntry(leafIndex: number, seed: number) {
  const bytes = Buffer.alloc(32, seed);
  return {
    val: {
      contractData: () => ({
        key: () => treeLeafKeyScValue(leafIndex),
        val: () => xdr.ScVal.scvBytes(bytes),
      }),
    },
  };
}

describe('fetchAndMergeMerkleState', () => {
  beforeEach(() => {
    mocks.getCommitmentCount.mockReset();
    mocks.getMerkleRoot.mockReset();
    mocks.getLedgerEntries.mockReset();
    mocks.getMerkleRoot.mockResolvedValue({ result: ROOT });
  });

  it('skips ledger reads when the cache already matches count and root', async () => {
    mocks.getCommitmentCount.mockResolvedValue({ result: 2 });
    const set = vi.fn();
    const poolMerkleState: PoolMerkleStatePort = {
      get: async () => ({
        poolContract: POOL,
        commitments: ['1', '2'],
        commitmentCount: 2,
        merkleRootHex: ROOT.toString('hex'),
        updatedAt: 10,
        nodes: [{ level: 1, index: 0, value: '1' }],
      }),
      set,
    };
    const result = await fetchAndMergeMerkleState({
      poolContractId: POOL,
      walletPublicKey: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
      transactEnvironment: environment(),
      poolMerkleState,
    });
    expect(result.commitments).toEqual(['1', '2']);
    expect(result.nodes).toEqual([{ level: 1, index: 0, value: '1' }]);
    expect(mocks.getLedgerEntries).not.toHaveBeenCalled();
    expect(set).not.toHaveBeenCalled();
  });

  it('fetches only new leaves when the cached prefix is still valid', async () => {
    mocks.getCommitmentCount.mockResolvedValue({ result: 2 });
    mocks.getLedgerEntries.mockResolvedValue({
      entries: [leafEntry(1, 2)],
    });
    const set = vi.fn();
    const poolMerkleState: PoolMerkleStatePort = {
      get: async () => ({
        poolContract: POOL,
        commitments: [commitmentBufferToDecimal(Buffer.alloc(32, 1))],
        commitmentCount: 1,
        merkleRootHex: 'old-root',
        updatedAt: 10,
      }),
      set,
    };
    const result = await fetchAndMergeMerkleState({
      poolContractId: POOL,
      walletPublicKey: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
      transactEnvironment: environment(),
      poolMerkleState,
    });
    expect(result.commitments).toEqual([
      commitmentBufferToDecimal(Buffer.alloc(32, 1)),
      commitmentBufferToDecimal(Buffer.alloc(32, 2)),
    ]);
    expect(mocks.getLedgerEntries).toHaveBeenCalledTimes(1);
    expect(set).toHaveBeenCalledTimes(1);
  });
});
