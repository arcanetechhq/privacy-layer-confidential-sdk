import type { StateFile } from '@arcanetech/stellar-privacy-pool-zk-sdk';
import type { StellarLeanImtNode } from '../../state/domain/types.js';
import { merkleRootHexToFrDecimal } from './field-decimal.js';

export function merkleSnapshotToStateFile(input: {
  commitments: string[];
  merkleRootHex: string;
  nodes?: StellarLeanImtNode[];
}): StateFile {
  const root = merkleRootHexToFrDecimal(input.merkleRootHex);
  const nodes = input.nodes;
  if (!nodes || nodes.length === 0 || root === undefined) {
    return { commitments: input.commitments };
  }
  return {
    commitments: input.commitments,
    nodes,
    root,
  };
}
