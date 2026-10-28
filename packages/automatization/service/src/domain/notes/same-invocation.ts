import type { TransactInvocation } from '../../ports/index.js';

export function sameInvocation(
  left: TransactInvocation,
  right: TransactInvocation,
): boolean {
  if (left.root !== right.root) {
    return false;
  }
  if (left.pinnedOutputCommitments.length !== right.pinnedOutputCommitments.length) {
    return false;
  }
  for (let index = 0; index < left.pinnedOutputCommitments.length; index += 1) {
    if (left.pinnedOutputCommitments[index] !== right.pinnedOutputCommitments[index]) {
      return false;
    }
  }
  return true;
}
