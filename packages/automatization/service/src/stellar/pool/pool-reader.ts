import {
  stepsInRow,
  type PinnedNote,
  type PinnedNotePresence,
} from '@arcanetech/privacy-sdk-automatization-plan';
import { readTreeLeafCommitments } from '@arcanetech/privacy-sdk-stellar/transact';
import { xdr, type rpc } from '@stellar/stellar-sdk';
import type { CurrentRoot, PlanStore, Presence } from '../../ports/index.js';
import {
  bytesValue,
  fieldBytes,
  hexToDecimal,
  simulateView,
  sorobanServer,
  type StellarPoolNetwork,
} from '../shared/index.js';

const DEFAULT_VIEW_CACHE_MS = 2000;

export interface SorobanPoolReaderConfig {
  readonly network: StellarPoolNetwork;
  readonly store: Pick<PlanStore, 'ids' | 'read'>;
  readonly viewCacheMs?: number;
}

export interface SorobanPoolReader {
  readonly currentRoot: CurrentRoot;
  readonly presence: Presence;
  readRoot(): Promise<string>;
  readLeaves(): Promise<readonly string[]>;
  forget(): void;
}

interface Cached<T> {
  readonly at: number;
  readonly value: T;
}

interface PoolView {
  readonly server: rpc.Server;
  readonly network: StellarPoolNetwork;
}

function call(
  view: PoolView,
  method: string,
  args: readonly xdr.ScVal[] = [],
): Promise<xdr.ScVal> {
  return simulateView({
    server: view.server,
    networkPassphrase: view.network.networkPassphrase,
    contractId: view.network.poolContract,
    method,
    args,
  });
}

async function readRoot(view: PoolView): Promise<string> {
  const value = await call(view, 'get_merkle_root');
  return hexToDecimal(bytesValue(value, 'Pool root').toString('hex'));
}

async function readLeaves(view: PoolView): Promise<readonly string[]> {
  const count = await call(view, 'get_commitment_count');
  if (count.switch() !== xdr.ScValType.scvU32()) {
    throw new Error('Pool commitment count did not return a u32');
  }
  return readTreeLeafCommitments({
    reader: view.server,
    contractId: view.network.poolContract,
    startIndex: 0,
    endIndex: count.u32(),
  });
}

async function isConsumed(view: PoolView, nullifierHash: string): Promise<boolean> {
  const value = await call(view, 'is_nulifier_hash_consumed', [
    xdr.ScVal.scvBytes(fieldBytes(nullifierHash)),
  ]);
  return value.switch() === xdr.ScValType.scvBool() && value.b();
}

async function pinnedNotes(
  store: Pick<PlanStore, 'ids' | 'read'>,
): Promise<PinnedNote[]> {
  const notes: PinnedNote[] = [];
  for (const id of await store.ids()) {
    const plan = await store.read(id);
    for (const step of plan.rows.flatMap((row) => stepsInRow(row))) {
      notes.push(...step.pinnedInputs, ...step.pinnedOutputs);
    }
  }
  return notes;
}

async function readPresence(
  view: PoolView,
  store: Pick<PlanStore, 'ids' | 'read'>,
): Promise<PinnedNotePresence> {
  const consumed: string[] = [];
  for (const note of await pinnedNotes(store)) {
    if (
      /^\d+$/u.test(note.nullifierHash) &&
      (await isConsumed(view, note.nullifierHash))
    ) {
      consumed.push(note.nullifierHash);
    }
  }
  return {
    consumedNullifierHashes: consumed,
    outputCommitmentsInPoolTree: [...(await readLeaves(view))],
  };
}

function cachedRead<T>(ttlMs: number, read: () => Promise<T>) {
  let cached: Cached<T> | undefined;
  return {
    async get(): Promise<T> {
      if (cached !== undefined && Date.now() - cached.at < ttlMs) {
        return cached.value;
      }
      const value = await read();
      cached = { at: Date.now(), value };
      return value;
    },
    forget(): void {
      cached = undefined;
    },
  };
}

export function createSorobanPoolReader(
  config: SorobanPoolReaderConfig,
): SorobanPoolReader {
  const view: PoolView = {
    server: sorobanServer(config.network.rpcUrl),
    network: config.network,
  };
  const ttl = config.viewCacheMs ?? DEFAULT_VIEW_CACHE_MS;
  const root = cachedRead(ttl, () => readRoot(view));
  const presence = cachedRead(ttl, () => readPresence(view, config.store));
  return {
    currentRoot: { current: () => root.get() },
    presence: { report: () => presence.get() },
    readRoot: () => readRoot(view),
    readLeaves: () => readLeaves(view),
    forget() {
      root.forget();
      presence.forget();
    },
  };
}
