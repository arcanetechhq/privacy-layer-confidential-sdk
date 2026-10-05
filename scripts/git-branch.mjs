import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export function isDirectRun(metaUrl) {
  const entry = process.argv[1];
  if (!entry) {
    return false;
  }
  return metaUrl === pathToFileURL(path.resolve(entry)).href;
}

export function readCurrentBranch() {
  const head = readFileSync(gitHeadFile(), 'utf8').trim();
  const prefix = 'ref: refs/heads/';
  return head.startsWith(prefix) ? head.slice(prefix.length) : '';
}

function gitHeadFile() {
  if (statSync('.git').isDirectory()) {
    return '.git/HEAD';
  }
  const line = readFileSync('.git', 'utf8').trim();
  const marker = 'gitdir: ';
  if (!line.startsWith(marker)) {
    throw new Error('Could not read the git directory.');
  }
  return `${line.slice(marker.length)}/HEAD`;
}
