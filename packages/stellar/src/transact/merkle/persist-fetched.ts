import type {
  StellarLeanImtNode,
  StellarPoolMerkleState,
} from '../../state/domain/types.js';
import type { CachedPoolMerkleView, PoolMerkleStatePort } from './state-port.js';
import { resolveExtendedMerkleNodes } from './tree-session.js';

export interface FetchContractMerkleResult {
  commitmentCount: number;
  commitments: string[];
  merkleRootHex: string;
  updatedAt: number;
  nodes?: StellarLeanImtNode[];
}

export function cachedMerkleUnchanged(
  cachedState: CachedPoolMerkleView | undefined,
  commitments: string[],
  merkleRootHex: string,
): boolean {
  if (!cachedState) {
    return false;
  }
  if (cachedState.commitments.length !== commitments.length) {
    return false;
  }
  return cachedState.merkleRootHex === merkleRootHex;
}

export function viewFromCachedMerkle(
  cachedState: CachedPoolMerkleView,
  merkleRootHex: string,
): FetchContractMerkleResult {
  return {
    commitments: cachedState.commitments,
    updatedAt: cachedState.updatedAt,
    merkleRootHex: cachedState.merkleRootHex ?? merkleRootHex,
    commitmentCount: cachedState.commitments.length,
    ...(cachedState.nodes ? { nodes: cachedState.nodes } : {}),
  };
}

function merkleStateForPersist(input: {
  poolContractId: string;
  commitments: string[];
  merkleRootHex: string;
  updatedAt: number;
  nodes?: StellarLeanImtNode[];
}): StellarPoolMerkleState {
  return {
    poolContract: input.poolContractId,
    commitments: input.commitments,
    commitmentCount: input.commitments.length,
    merkleRootHex: input.merkleRootHex,
    updatedAt: input.updatedAt,
    ...(input.nodes ? { nodes: input.nodes } : {}),
  };
}

export async function persistFetchedMerkleState(input: {
  poolContractId: string;
  commitments: string[];
  merkleRootHex: string;
  cachedState: CachedPoolMerkleView | undefined;
  poolMerkleState?: PoolMerkleStatePort;
}): Promise<FetchContractMerkleResult> {
  const cachedState = input.cachedState;
  if (
    cachedMerkleUnchanged(cachedState, input.commitments, input.merkleRootHex) &&
    cachedState
  ) {
    return viewFromCachedMerkle(cachedState, input.merkleRootHex);
  }
  const nodes = await resolveExtendedMerkleNodes({
    poolContract: input.poolContractId,
    commitments: input.commitments,
    merkleRootHex: input.merkleRootHex,
    ...(cachedState ? { cachedState } : {}),
  });
  const updatedAt = Date.now();
  await input.poolMerkleState?.set(
    merkleStateForPersist({
      poolContractId: input.poolContractId,
      commitments: input.commitments,
      merkleRootHex: input.merkleRootHex,
      updatedAt,
      ...(nodes ? { nodes } : {}),
    }),
  );
  return {
    commitments: input.commitments,
    updatedAt,
    merkleRootHex: input.merkleRootHex,
    commitmentCount: input.commitments.length,
    ...(nodes ? { nodes } : {}),
  };
}
