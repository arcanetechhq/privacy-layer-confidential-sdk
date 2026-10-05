import { existsSync, writeFileSync } from 'node:fs';
import { getPackages } from '@manypkg/get-packages';
import { expectedMajorForRef, resolveBranchRef } from './check-majors.mjs';
import { isDirectRun, readCurrentBranch } from './git-branch.mjs';

const CHANGESET_PATH = '.changeset/major-all-packages.md';

export function renderMajorChangeset(names) {
  const lines = names.map((name) => `"${name}": major`);
  return `---\n${lines.join('\n')}\n---\n\nRaise every public package to the next major version.\n`;
}

export function assertMajorChangesetAllowed(ref) {
  if (expectedMajorForRef(ref) !== undefined) {
    throw new Error(`Refusing to add a major changeset on ${ref}.`);
  }
}

function publicPackageNames(packages) {
  return packages
    .filter((workspacePackage) => workspacePackage.packageJson.private !== true)
    .map((workspacePackage) => workspacePackage.packageJson.name);
}

async function main() {
  const ref = resolveBranchRef(process.env, readCurrentBranch());
  assertMajorChangesetAllowed(ref);
  if (existsSync(CHANGESET_PATH)) {
    throw new Error(`${CHANGESET_PATH} already exists.`);
  }
  const { packages } = await getPackages(process.cwd());
  const names = publicPackageNames(packages);
  if (names.length === 0) {
    throw new Error('No public packages found.');
  }
  writeFileSync(CHANGESET_PATH, renderMajorChangeset(names));
}

if (isDirectRun(import.meta.url)) {
  await main();
}
