import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { expectedMajorForRef, resolveBranchRef } from './check-majors.mjs';
import { isDirectRun, readCurrentBranch } from './git-branch.mjs';

export function resolveDistributionTag(ref) {
  const expected = expectedMajorForRef(ref);
  return expected === undefined ? 'latest' : `v${expected}`;
}

function publishRelease(ref) {
  const tag = resolveDistributionTag(ref);
  const changesetBin = fileURLToPath(import.meta.resolve('@changesets/cli/bin.js'));
  execFileSync(process.execPath, ['scripts/check-majors.mjs'], { stdio: 'inherit' });
  execFileSync(process.execPath, [changesetBin, 'publish', '--tag', tag], {
    stdio: 'inherit',
  });
}

if (isDirectRun(import.meta.url)) {
  publishRelease(resolveBranchRef(process.env, readCurrentBranch()));
}
