import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { expectedMajorForRef, resolveBranchRef } from './check-majors.mjs';
import { isDirectRun, readCurrentBranch } from './git-branch.mjs';

export function resolveDistributionTag(ref) {
  const expected = expectedMajorForRef(ref);
  if (expected === undefined) {
    return 'latest';
  }
  // npm 11 rejects a dist-tag that is a semver range. `v0` and `v1` are ranges.
  return `release-v${expected}`;
}

export function publishEnvironment() {
  const env = { ...process.env };
  delete env.NODE_AUTH_TOKEN;
  delete env.NPM_TOKEN;
  return env;
}

function publishRelease(ref) {
  const tag = resolveDistributionTag(ref);
  const changesetBin = fileURLToPath(import.meta.resolve('@changesets/cli/bin.js'));
  const env = publishEnvironment();
  execFileSync(process.execPath, ['scripts/check-majors.mjs'], {
    stdio: 'inherit',
    env,
  });
  execFileSync(process.execPath, [changesetBin, 'publish', '--tag', tag], {
    stdio: 'inherit',
    env,
  });
}

if (isDirectRun(import.meta.url)) {
  publishRelease(resolveBranchRef(process.env, readCurrentBranch()));
}
