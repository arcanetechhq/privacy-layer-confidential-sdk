import { Buffer } from 'buffer';
import type {
  CachedPoolMerkleView,
  PoolMerkleStatePort,
  LeafEphemeralStatePort,
} from '../merkle/state-port.js';
import { poolMerkleStateToCachedView } from '../merkle/state-port.js';
import { readPoolClientFactory } from '../../contracts/contract-context.js';
import { createStellarRpcServer } from '../../rpc/server.js';
import type { StellarTransactEnvironment } from '../environment/types.js';
import type { PoolTransactClient } from '../pool/types.js';
import { readTreeLeafCommitments } from './read-tree-leaves.js';
import { reuseCachedCommitments } from './reuse-cached-commitments.js';
import { persistFetchedMerkleState } from './persist-fetched.js';

export { type FetchContractMerkleResult } from './persist-fetched.js';

/**
 * Loads pool Merkle leaves without `get_commitments()`. That helper walks the
 * whole tree in one simulate and exceeds the Soroban host budget on a live
 * stand. Completes the cached prefix from persistent `TreeDataKey::Leaf`
 * ledger entries instead.
 */
export async function fetchAndMergeMerkleState(parameters: {
  poolContractId: string;
  walletPublicKey: string;
  transactEnvironment: StellarTransactEnvironment;
  poolMerkleState?: PoolMerkleStatePort;
}): Promise<Awaited<ReturnType<typeof persistFetchedMerkleState>>> {
  const client = createPoolClient(parameters);
  const countRead = await client.get_commitment_count();
  const onChainCount = requireCommitmentCount(countRead.result);
  const rootRead = await client.get_merkle_root();
  const merkleRootHex = merkleRootToHex(rootRead.result);
  const cachedState = await readCachedPoolMerkleView(
    parameters.poolMerkleState,
    parameters.poolContractId,
  );
  const commitments = await loadCommitments({
    cachedState,
    onChainCount,
    merkleRootHex,
    rpcUrl: parameters.transactEnvironment.network.rpcUrl,
    contractId: parameters.poolContractId,
  });
  return persistFetchedMerkleState({
    poolContractId: parameters.poolContractId,
    commitments,
    merkleRootHex,
    cachedState,
    ...(parameters.poolMerkleState
      ? { poolMerkleState: parameters.poolMerkleState }
      : {}),
  });
}

export async function readLeafEphemeralHex(parameters: {
  poolContractId: string;
  walletPublicKey: string;
  leafIndex: number;
  transactEnvironment: StellarTransactEnvironment;
  leafEphemeral?: LeafEphemeralStatePort;
}): Promise<{ xHex: string; yHex: string }> {
  const cached = await parameters.leafEphemeral?.get({
    poolContract: parameters.poolContractId,
    leafIndex: parameters.leafIndex,
  });
  if (cached?.xHex && cached.yHex) {
    return { xHex: cached.xHex, yHex: cached.yHex };
  }
  const client = createPoolClient(parameters);
  const read = await client.get_leaf_ephemeral({ leaf_index: parameters.leafIndex });
  const coords = read.result;
  if (!coords?.x || !coords?.y) {
    throw new Error('Missing leaf ephemeral key on contract');
  }
  const xHex = Buffer.from(coords.x).toString('hex');
  const yHex = Buffer.from(coords.y).toString('hex');
  await parameters.leafEphemeral?.set({
    poolContract: parameters.poolContractId,
    leafIndex: parameters.leafIndex,
    xHex,
    yHex,
    cachedAt: new Date().toISOString(),
  });
  return { xHex, yHex };
}

function createPoolClient(parameters: {
  poolContractId: string;
  walletPublicKey: string;
  transactEnvironment: StellarTransactEnvironment;
}): PoolTransactClient {
  return readPoolClientFactory(parameters.transactEnvironment)({
    contractId: parameters.poolContractId,
    walletPublicKey: parameters.walletPublicKey,
    networkPassphrase: parameters.transactEnvironment.network.networkPassphrase,
    sorobanRpcUrl: parameters.transactEnvironment.network.rpcUrl,
  });
}

function requireCommitmentCount(result: unknown): number {
  if (typeof result === 'number' && Number.isInteger(result) && result >= 0) {
    return result;
  }
  throw new Error('Pool commitment count is not a non-negative integer.');
}

function merkleRootToHex(root: Buffer): string {
  return Buffer.from(root).toString('hex');
}

async function readCachedPoolMerkleView(
  poolMerkleState: PoolMerkleStatePort | undefined,
  poolContractId: string,
): Promise<CachedPoolMerkleView | undefined> {
  if (!poolMerkleState) {
    return undefined;
  }
  const cached = await poolMerkleState.get(poolContractId);
  return cached ? poolMerkleStateToCachedView(cached) : undefined;
}

async function loadCommitments(input: {
  cachedState: CachedPoolMerkleView | undefined;
  onChainCount: number;
  merkleRootHex: string;
  rpcUrl: string;
  contractId: string;
}): Promise<string[]> {
  const reused = reuseCachedCommitments({
    cachedState: input.cachedState,
    onChainCount: input.onChainCount,
    merkleRootHex: input.merkleRootHex,
  });
  if (reused.length === input.onChainCount) {
    return reused;
  }
  const fetched = await readTreeLeafCommitments({
    reader: createStellarRpcServer(input.rpcUrl),
    contractId: input.contractId,
    startIndex: reused.length,
    endIndex: input.onChainCount,
  });
  return [...reused, ...fetched];
}
