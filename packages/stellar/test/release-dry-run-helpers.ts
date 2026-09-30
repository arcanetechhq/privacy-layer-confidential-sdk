import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  accessSync,
  constants,
  mkdtempSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
export const root = path.resolve(packageRoot, '../..');
export const script = path.resolve(root, 'scripts/release-dry-run.sh');
export const packageJsonPath = path.resolve(packageRoot, 'package.json');
export const ZK_SDK_DEP = '@arcanetech/stellar-privacy-pool-zk-sdk';
export const EXPECTED_ZK_RANGE = '>=0.11.0 <1.0.0';
export const LINE_0_MANIFEST_PATTERN =
  /^circuits-manifest:\s*stellar\/v0\/circuits-manifest\.json$/m;
export const LINE_1_MANIFEST_PATTERN =
  /^circuits-manifest:\s*stellar\/v1\/circuits-manifest\.json$/m;
export const STELLAR_SELECTED_PATTERN =
  /^publish-selected:\s*@arcanetech\/privacy-sdk-stellar$/m;
export const LINE_0_SELECTED_PATTERN =
  /^publish-selected:.*privacy-sdk-stellar.*privacy-sdk-core.*(?:privacy-sdk-state|privacy-sdk-relay)/im;
export const CORE_STATE_RELAY_SKIPPED_PATTERN =
  /^publish-skipped:.*(?:core|state|relay)/im;
export const STELLAR_PACKAGE_JSON = 'packages/stellar/package.json';
export const RELEASE_MANIFEST = 'artifacts/circuits-manifest.json';

const GIT_CANDIDATES = [
  '/usr/bin/git',
  '/opt/homebrew/bin/git',
  '/usr/local/bin/git',
] as const;

function resolveGitBinary(): string {
  for (const candidate of GIT_CANDIDATES) {
    try {
      accessSync(candidate, constants.X_OK);
      return candidate;
    } catch {
      // try the next known absolute path
    }
  }
  throw new Error('git binary not found in fixed paths');
}

export const gitBinary = resolveGitBinary();

export function runReleaseDryRun({
  releaseLine,
  commitMessage,
  promoteStable,
  stable1xPublished,
  mergeFrom,
  mergeInto,
  mergeRepo,
  dryRun = '1',
}: {
  releaseLine: string;
  commitMessage: string;
  promoteStable?: string;
  stable1xPublished?: string;
  mergeFrom?: string;
  mergeInto?: string;
  mergeRepo?: string;
  dryRun?: '0' | '1';
}) {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    DRY_RUN: dryRun,
    RELEASE_LINE: releaseLine,
    COMMIT_MESSAGE: commitMessage,
  };
  if (promoteStable !== undefined) {
    env.PROMOTE_STABLE = promoteStable;
  }
  if (stable1xPublished !== undefined) {
    env.STABLE_1X_PUBLISHED = stable1xPublished;
  }
  if (mergeFrom !== undefined) {
    env.MERGE_FROM = mergeFrom;
  }
  if (mergeInto !== undefined) {
    env.MERGE_INTO = mergeInto;
  }
  if (mergeRepo !== undefined) {
    env.MERGE_REPO = mergeRepo;
  }
  return spawnSync(script, [], {
    cwd: root,
    encoding: 'utf8',
    env: isolatedGitEnv(env),
  });
}

function isolatedGitEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const isolated = { ...env };
  delete isolated.GIT_DIR;
  delete isolated.GIT_WORK_TREE;
  delete isolated.GIT_INDEX_FILE;
  delete isolated.GIT_PREFIX;
  return isolated;
}

export function git(cwd: string, args: string[]): string {
  const result = spawnSync(
    gitBinary,
    ['-c', 'core.hooksPath=/dev/null', '-c', 'init.templateDir=', ...args],
    {
      cwd,
      encoding: 'utf8',
      env: isolatedGitEnv({
        ...process.env,
        GIT_CONFIG_NOSYSTEM: '1',
        GIT_CONFIG_GLOBAL: '/dev/null',
        GIT_TEMPLATE_DIR: '',
      }),
    },
  );
  assert.equal(
    result.status,
    0,
    `git ${args.join(' ')} failed: ${result.stderr || result.stdout}`,
  );
  return result.stdout.trim();
}

function writeTree(directory: string, files: Record<string, string>) {
  for (const [relativePath, content] of Object.entries(files)) {
    const absolutePath = path.join(directory, relativePath);
    mkdirSync(path.dirname(absolutePath), { recursive: true });
    writeFileSync(absolutePath, content);
  }
}

export function stellarPackageJson(
  version: string,
  zkRange: string,
  extra = '',
): string {
  return `{\n  "name": "@arcanetech/privacy-sdk-stellar",\n  "version": "${version}",\n  "dependencies": {\n    "${ZK_SDK_DEP}": "${zkRange}"\n  }${extra}\n}\n`;
}

function commitBranchTip(input: {
  directory: string;
  branchName: string;
  baseFiles: Record<string, string>;
  mutateBranch?: (files: Record<string, string>) => void;
  startAt?: string;
}): string {
  if (input.startAt !== undefined) {
    git(input.directory, ['checkout', '-q', input.startAt]);
  }
  git(input.directory, ['checkout', '-qb', input.branchName]);
  const files = { ...input.baseFiles };
  input.mutateBranch?.(files);
  writeTree(input.directory, files);
  git(input.directory, ['add', '-A']);
  git(input.directory, ['commit', '--allow-empty', '-qm', `${input.branchName} tip`]);
  return git(input.directory, ['rev-parse', 'HEAD']);
}

export function createMergeFixture(mutate: {
  line0?: (files: Record<string, string>) => void;
  line1?: (files: Record<string, string>) => void;
}) {
  const directory = mkdtempSync(path.join(tmpdir(), 'privacy-sdk-merge-'));
  git(directory, ['init', '-q']);
  git(directory, ['config', 'user.email', 'merge-fixture@test']);
  git(directory, ['config', 'user.name', 'merge-fixture']);

  const baseFiles: Record<string, string> = {
    [STELLAR_PACKAGE_JSON]: stellarPackageJson('1.0.0-rc.0', '>=1.0.0 <2.0.0'),
    [RELEASE_MANIFEST]: '{"circuits":{}}\n',
    'packages/stellar/src/unprotected.ts': 'base unprotected\n',
  };
  writeTree(directory, baseFiles);
  git(directory, ['add', '.']);
  git(directory, ['commit', '-qm', 'base']);
  const base = git(directory, ['rev-parse', 'HEAD']);
  const line0 = commitBranchTip({
    directory,
    branchName: 'line0',
    baseFiles,
    ...(mutate.line0 === undefined ? {} : { mutateBranch: mutate.line0 }),
  });
  const line1 = commitBranchTip({
    directory,
    branchName: 'line1',
    baseFiles,
    ...(mutate.line1 === undefined ? {} : { mutateBranch: mutate.line1 }),
    startAt: base,
  });

  return {
    directory,
    line0,
    line1,
    cleanup() {
      rmSync(directory, { recursive: true, force: true });
    },
  };
}

function countTarballs(directory: string): number {
  return readdirSync(directory).filter((name) => name.endsWith('.tgz')).length;
}

export function tarballCount(): number {
  return countTarballs(root) + countTarballs(packageRoot);
}

export function listGitTags(): string {
  return spawnSync(gitBinary, ['tag', '--list'], {
    cwd: root,
    encoding: 'utf8',
  }).stdout;
}

export function readZkSdkRange(packageJsonText: string): string {
  const parsed = JSON.parse(packageJsonText) as {
    version: string;
    dependencies: Record<string, string>;
  };
  assert.equal(parsed.version, '0.6.1');
  const entry = Object.entries(parsed.dependencies).find(
    ([name]) => name === ZK_SDK_DEP,
  );
  assert.ok(entry);
  return entry[1];
}

export function assertNoLocalSideEffects(
  packageBefore: string,
  tagsBefore: string,
  tarballsBefore: number,
) {
  const after = readFileSync(packageJsonPath, 'utf8');
  assert.equal(after, packageBefore);
  assert.equal(readZkSdkRange(after), EXPECTED_ZK_RANGE);
  assert.equal(listGitTags(), tagsBefore);
  assert.equal(tarballCount(), tarballsBefore);
}

export function assertPackedDryRun(stdout: string) {
  assert.match(stdout, /\.tgz\b/);
  assert.match(stdout, /packed.*skipped publish/i);
  assert.doesNotMatch(stdout, /\bnpm publish\b/);
}
