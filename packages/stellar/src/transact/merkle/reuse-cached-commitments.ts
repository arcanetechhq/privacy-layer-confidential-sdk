import type { CachedPoolMerkleView } from './state-port.js';

function completeCacheRootMatches(
  cachedState: CachedPoolMerkleView | undefined,
  merkleRootHex: string,
): boolean {
  const cachedRoot = cachedState?.merkleRootHex;
  if (!cachedRoot) {
    return false;
  }
  return cachedRoot === merkleRootHex;
}

export function reuseCachedCommitments(input: {
  cachedState: CachedPoolMerkleView | undefined;
  onChainCount: number;
  merkleRootHex: string;
}): string[] {
  const cachedCommitments = input.cachedState?.commitments ?? [];
  if (cachedCommitments.length === 0) {
    return [];
  }
  if (cachedCommitments.length > input.onChainCount) {
    return [];
  }
  if (cachedCommitments.length === input.onChainCount) {
    return completeCacheRootMatches(input.cachedState, input.merkleRootHex)
      ? cachedCommitments
      : [];
  }
  return cachedCommitments;
}
