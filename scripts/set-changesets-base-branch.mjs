import { readFileSync, writeFileSync } from 'node:fs';
import { isDirectRun } from './git-branch.mjs';

const CONFIG_PATH = '.changeset/config.json';

export function withBaseBranch(config, branch) {
  if (!/^release\/v(\d+)$/.test(branch) && branch !== 'main') {
    throw new Error(`Expected main or release/vN, received: ${branch}`);
  }
  return { ...config, baseBranch: branch };
}

function main() {
  const branch = process.argv[2];
  const config = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));
  const next = `${JSON.stringify(withBaseBranch(config, branch), undefined, 2)}\n`;
  writeFileSync(CONFIG_PATH, next);
}

if (isDirectRun(import.meta.url)) {
  main();
}
