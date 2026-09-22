import type {
  CoinData,
  PrivacyPoolSDK,
  StateFile,
  WithdrawMerkleWitness,
} from '@arcanetech/stellar-privacy-pool-zk-sdk';
import { asLeanImtSessionApi, type LeanImtSessionApi } from './lean-imt-api.js';
import { extendMerkleSnapshotNodes } from './extend-snapshot.js';
import { merkleSnapshotToStateFile } from './state-file.js';
import type { CachedPoolMerkleView } from './state-port.js';
import type {
  StellarLeanImtNode,
  StellarPoolMerkleState,
} from '../../state/domain/types.js';

type MerkleSdkHost = {
  getInitializedSdk: () => Promise<object>;
};

let merkleSdkHost: MerkleSdkHost | undefined;

export function registerMerkleSessionSdkHost(host: MerkleSdkHost | undefined): void {
  merkleSdkHost = host;
}

async function loadSessionSdk(): Promise<LeanImtSessionApi | undefined> {
  const host = merkleSdkHost;
  if (typeof host?.getInitializedSdk !== 'function') {
    return undefined;
  }
  try {
    return asLeanImtSessionApi(await host.getInitializedSdk());
  } catch {
    return undefined;
  }
}

type MerkleTreeSession = {
  handle: number;
  key: string;
};

const sessionsByPool = new Map<string, MerkleTreeSession>();
const handlesByKey = new Map<string, number>();

function merkleSessionKey(state: StateFile): string {
  const root = state.root?.trim();
  if (root) {
    return `${state.commitments.length}:${root}`;
  }
  const first = state.commitments[0] ?? '';
  const last = state.commitments.at(-1) ?? '';
  return `${state.commitments.length}:${first}:${last}`;
}

function rememberHandle(poolContract: string, key: string, handle: number): void {
  const existing = sessionsByPool.get(poolContract);
  if (existing && existing.handle !== handle) {
    handlesByKey.delete(existing.key);
  }
  sessionsByPool.set(poolContract, { handle, key });
  handlesByKey.set(key, handle);
}

function importHandle(sdk: LeanImtSessionApi, state: StateFile): number | undefined {
  try {
    return sdk.importLeanImtFromState(state);
  } catch {
    return undefined;
  }
}

function merkleTreeHandleForState(state: StateFile): number | undefined {
  return handlesByKey.get(merkleSessionKey(state));
}

function bindImportedMerkleTree(input: {
  poolContract: string;
  state: StateFile;
  handle: number;
}): void {
  rememberHandle(input.poolContract, merkleSessionKey(input.state), input.handle);
}

export async function bindPoolMerkleTree(
  state: StellarPoolMerkleState,
): Promise<number | undefined> {
  const sdk = await loadSessionSdk();
  if (!sdk) {
    return undefined;
  }
  const snapshot = merkleSnapshotToStateFile(state);
  const key = merkleSessionKey(snapshot);
  const existing = sessionsByPool.get(state.poolContract);
  if (existing?.key === key) {
    return existing.handle;
  }
  const handle = importHandle(sdk, snapshot);
  if (handle === undefined) {
    return undefined;
  }
  if (existing) {
    sdk.dropLeanImt(existing.handle);
  }
  rememberHandle(state.poolContract, key, handle);
  return handle;
}

export async function resolveExtendedMerkleNodes(input: {
  poolContract: string;
  cachedState?: CachedPoolMerkleView;
  commitments: string[];
  merkleRootHex: string;
}): Promise<StellarLeanImtNode[] | undefined> {
  const cached = input.cachedState;
  if (
    cached &&
    cached.commitments.length === input.commitments.length &&
    cached.merkleRootHex === input.merkleRootHex
  ) {
    return cached.nodes;
  }
  const sdk = await loadSessionSdk();
  if (!sdk) {
    return undefined;
  }
  const extended = extendMerkleSnapshotNodes({
    sdk,
    commitments: input.commitments,
    merkleRootHex: input.merkleRootHex,
    ...(cached ? { cachedState: cached } : {}),
  });
  if (extended.handle !== undefined) {
    bindImportedMerkleTree({
      poolContract: input.poolContract,
      handle: extended.handle,
      state: merkleSnapshotToStateFile({
        commitments: input.commitments,
        merkleRootHex: input.merkleRootHex,
        ...(extended.nodes ? { nodes: extended.nodes } : {}),
      }),
    });
  }
  return extended.nodes;
}

export function withdrawMerkleWitnessFromTree(input: {
  sdk: PrivacyPoolSDK;
  coin: CoinData;
  state: StateFile;
}): WithdrawMerkleWitness {
  const session = asLeanImtSessionApi(input.sdk);
  const handle = merkleTreeHandleForState(input.state);
  if (session && handle !== undefined) {
    return session.buildWithdrawMerkleWitnessFromHandle(input.coin, handle);
  }
  return input.sdk.buildWithdrawMerkleWitness(input.coin, input.state);
}
