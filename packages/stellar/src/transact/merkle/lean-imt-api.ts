import type {
  CoinData,
  StateFile,
  WithdrawMerkleWitness,
} from '@arcanetech/stellar-privacy-pool-zk-sdk';
import type { StellarLeanImtNode } from '../../state/domain/types.js';

export interface LeanImtSnapshotView {
  depth: number;
  root: string;
  leaves: string[];
  nodes: StellarLeanImtNode[];
}

export interface LeanImtSessionApi {
  importLeanImtFromState: (state: StateFile) => number;
  insertTwoLeanImt: (handle: number, leafA: string, leafB: string) => string;
  exportLeanImt: (handle: number) => LeanImtSnapshotView;
  dropLeanImt: (handle: number) => void;
  buildWithdrawMerkleWitnessFromHandle: (
    coin: CoinData,
    handle: number,
  ) => WithdrawMerkleWitness;
}

export function asLeanImtSessionApi(sdk: object): LeanImtSessionApi | undefined {
  const candidate = sdk as Partial<LeanImtSessionApi>;
  if (typeof candidate.importLeanImtFromState !== 'function') {
    return undefined;
  }
  if (typeof candidate.insertTwoLeanImt !== 'function') {
    return undefined;
  }
  if (typeof candidate.exportLeanImt !== 'function') {
    return undefined;
  }
  if (typeof candidate.dropLeanImt !== 'function') {
    return undefined;
  }
  if (typeof candidate.buildWithdrawMerkleWitnessFromHandle !== 'function') {
    return undefined;
  }
  return candidate as LeanImtSessionApi;
}
