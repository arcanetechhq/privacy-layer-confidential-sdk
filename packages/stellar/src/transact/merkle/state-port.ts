import type {
  StellarLeafEphemeral,
  StellarLeanImtNode,
  StellarPoolMerkleState,
} from '../../state/domain/types.js';

export interface PoolMerkleStatePort {
  get(poolContract: string): Promise<StellarPoolMerkleState | undefined>;
  set(state: StellarPoolMerkleState): Promise<void>;
}

export interface LeafEphemeralStatePort {
  get(input: {
    poolContract: string;
    leafIndex: number;
  }): Promise<StellarLeafEphemeral | undefined>;
  set(ephemeral: StellarLeafEphemeral): Promise<void>;
}

export interface CachedPoolMerkleView {
  commitments: string[];
  updatedAt: number;
  merkleRootHex?: string;
  nodes?: StellarLeanImtNode[];
}

export function poolMerkleStateToCachedView(
  state: StellarPoolMerkleState,
): CachedPoolMerkleView {
  return {
    commitments: state.commitments,
    updatedAt: state.updatedAt,
    merkleRootHex: state.merkleRootHex,
    ...(state.nodes ? { nodes: state.nodes } : {}),
  };
}
