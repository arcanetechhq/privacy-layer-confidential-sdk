import type { StateFile } from '@arcanetech/stellar-privacy-pool-zk-sdk';
import type { StellarLeanImtNode } from '../../state/domain/types.js';
import type { CachedPoolMerkleView } from './state-port.js';
import type { LeanImtSessionApi } from './lean-imt-api.js';
import { merkleSnapshotToStateFile } from './state-file.js';

export function isEvenLeafCount(count: number): boolean {
  return count % 2 === 0;
}

function importHandle(sdk: LeanImtSessionApi, state: StateFile): number | undefined {
  try {
    return sdk.importLeanImtFromState(state);
  } catch {
    return undefined;
  }
}

function insertNewPairs(input: {
  sdk: LeanImtSessionApi;
  handle: number;
  prefixLength: number;
  commitments: string[];
}): boolean {
  for (let index = input.prefixLength; index < input.commitments.length; index += 2) {
    const leafA = input.commitments.at(index);
    const leafB = input.commitments.at(index + 1);
    if (leafA === undefined || leafB === undefined) {
      return false;
    }
    try {
      input.sdk.insertTwoLeanImt(input.handle, leafA, leafB);
    } catch {
      return false;
    }
  }
  return true;
}

function snapshotNodes(
  sdk: LeanImtSessionApi,
  handle: number,
): StellarLeanImtNode[] | undefined {
  try {
    return sdk.exportLeanImt(handle).nodes;
  } catch {
    return undefined;
  }
}

function prefixSnapshotState(input: {
  cachedState?: CachedPoolMerkleView;
  commitments: string[];
  merkleRootHex: string;
}): StateFile {
  const prefixLength = input.cachedState?.nodes
    ? input.cachedState.commitments.length
    : 0;
  return merkleSnapshotToStateFile({
    commitments: input.commitments.slice(0, prefixLength),
    merkleRootHex: input.cachedState?.merkleRootHex ?? input.merkleRootHex,
    ...(input.cachedState?.nodes ? { nodes: input.cachedState.nodes } : {}),
  });
}

function importSnapshotState(input: {
  prefixState: StateFile;
  commitments: string[];
  merkleRootHex: string;
}): StateFile {
  if (input.prefixState.nodes && input.prefixState.commitments.length > 0) {
    return input.prefixState;
  }
  return merkleSnapshotToStateFile({
    commitments: input.commitments,
    merkleRootHex: input.merkleRootHex,
  });
}

function exportExtendedNodes(input: {
  sdk: LeanImtSessionApi;
  handle: number;
  prefixState: StateFile;
  commitments: string[];
}): StellarLeanImtNode[] | undefined {
  const inserted = input.prefixState.nodes
    ? insertNewPairs({
        sdk: input.sdk,
        handle: input.handle,
        prefixLength: input.prefixState.commitments.length,
        commitments: input.commitments,
      })
    : true;
  if (!inserted) {
    input.sdk.dropLeanImt(input.handle);
    return undefined;
  }
  const nodes = snapshotNodes(input.sdk, input.handle);
  if (!nodes) {
    input.sdk.dropLeanImt(input.handle);
  }
  return nodes;
}

export function extendMerkleSnapshotNodes(input: {
  sdk: LeanImtSessionApi;
  cachedState?: CachedPoolMerkleView;
  commitments: string[];
  merkleRootHex: string;
}): { nodes?: StellarLeanImtNode[]; handle?: number } {
  if (!isEvenLeafCount(input.commitments.length)) {
    return {};
  }
  const prefixState = prefixSnapshotState(input);
  const handle = importHandle(
    input.sdk,
    importSnapshotState({ ...input, prefixState }),
  );
  if (handle === undefined) {
    return {};
  }
  const nodes = exportExtendedNodes({
    sdk: input.sdk,
    handle,
    prefixState,
    commitments: input.commitments,
  });
  if (!nodes) {
    return {};
  }
  return { nodes, handle };
}
