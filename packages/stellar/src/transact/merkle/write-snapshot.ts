import type { StellarPoolMerkleState } from '../../state/domain/types.js';
import { poolMerkleStateToCachedView } from './state-port.js';
import { bindPoolMerkleTree, resolveExtendedMerkleNodes } from './tree-session.js';

export async function writePoolMerkleState(input: {
  setPoolMerkleState: (state: StellarPoolMerkleState) => Promise<void>;
  state: StellarPoolMerkleState;
}): Promise<void> {
  await input.setPoolMerkleState(input.state);
  await bindPoolMerkleTree(input.state);
}

export async function appendPoolMerkleCommitments(input: {
  getPoolMerkleState: (
    poolContract: string,
  ) => Promise<StellarPoolMerkleState | undefined>;
  appendPoolCommitments: (payload: {
    poolContract: string;
    commitments: string[];
    merkleRootHex: string;
    syncedLedger?: number;
    nodes?: StellarPoolMerkleState['nodes'];
  }) => Promise<void>;
  payload: {
    poolContract: string;
    commitments: string[];
    merkleRootHex: string;
    syncedLedger?: number;
    nodes?: StellarPoolMerkleState['nodes'];
  };
}): Promise<void> {
  const current = await input.getPoolMerkleState(input.payload.poolContract);
  const merged = [...(current?.commitments ?? []), ...input.payload.commitments];
  const nodes =
    input.payload.nodes ??
    (await resolveExtendedMerkleNodes({
      poolContract: input.payload.poolContract,
      commitments: merged,
      merkleRootHex: input.payload.merkleRootHex,
      ...(current ? { cachedState: poolMerkleStateToCachedView(current) } : {}),
    }));
  await input.appendPoolCommitments({
    poolContract: input.payload.poolContract,
    commitments: input.payload.commitments,
    merkleRootHex: input.payload.merkleRootHex,
    ...(input.payload.syncedLedger === undefined
      ? {}
      : { syncedLedger: input.payload.syncedLedger }),
    ...(nodes ? { nodes } : {}),
  });
  const written = await input.getPoolMerkleState(input.payload.poolContract);
  if (written) {
    await bindPoolMerkleTree(written);
  }
}
