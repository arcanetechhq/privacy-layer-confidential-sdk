import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { accessSync, constants, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'vitest';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const root = path.resolve(packageRoot, '../..');
const script = path.resolve(root, 'scripts/release-dry-run.sh');
const packageJsonPath = path.resolve(packageRoot, 'package.json');
const ZK_SDK_DEP = '@arcanetech/stellar-privacy-pool-zk-sdk';
const EXPECTED_ZK_RANGE = '>=0.11.0 <1.0.0';
const LINE_0_MANIFEST_PATTERN =
  /^circuits-manifest:\s*stellar\/v0\/circuits-manifest\.json$/m;
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

const gitBinary = resolveGitBinary();

function runReleaseDryRun({
  releaseLine,
  commitMessage,
}: {
  releaseLine: string;
  commitMessage: string;
}) {
  return spawnSync(script, [], {
    cwd: root,
    encoding: 'utf8',
    env: {
      ...process.env,
      DRY_RUN: '1',
      RELEASE_LINE: releaseLine,
      COMMIT_MESSAGE: commitMessage,
    },
  });
}

function countTarballs(directory: string): number {
  return readdirSync(directory).filter((name) => name.endsWith('.tgz')).length;
}

function tarballCount(): number {
  return countTarballs(root) + countTarballs(packageRoot);
}

function listGitTags(): string {
  return spawnSync(gitBinary, ['tag', '--list'], {
    cwd: root,
    encoding: 'utf8',
  }).stdout;
}

function readZkSdkRange(packageJsonText: string): string {
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

function assertNoLocalSideEffects(
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

function assertPackedDryRun(stdout: string) {
  assert.match(stdout, /\.tgz\b/);
  assert.match(stdout, /packed.*skipped publish/i);
  assert.doesNotMatch(stdout, /\bnpm publish\b/);
}

describe('release-dry-run line 0 plan', () => {
  const packageBefore = readFileSync(packageJsonPath, 'utf8');
  const tagsBefore = listGitTags();
  const tarballsBefore = tarballCount();

  it('keeps the Stellar zk SDK range at >=0.11.0 <1.0.0', () => {
    assert.equal(readZkSdkRange(packageBefore), EXPECTED_ZK_RANGE);
  });

  it('prints the next stable patch and dist-tags v0 latest for fix', () => {
    const result = runReleaseDryRun({
      releaseLine: '0',
      commitMessage: 'fix: example',
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /\bversion:\s*0\.6\.2\b/);
    assert.match(result.stdout, /\bv0\b/);
    assert.match(result.stdout, /\blatest\b/);
    assert.match(result.stdout, LINE_0_MANIFEST_PATTERN);
    assert.match(result.stdout, /^breaking-commit: allow$/m);
    assert.match(result.stdout, /^protected-path: allow$/m);
    assertPackedDryRun(result.stdout);
    assertNoLocalSideEffects(packageBefore, tagsBefore, tarballsBefore);
  });

  it('prints the next stable minor and dist-tags v0 latest for feat', () => {
    const result = runReleaseDryRun({
      releaseLine: '0',
      commitMessage: 'feat: example',
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /\bversion:\s*0\.7\.0\b/);
    assert.match(result.stdout, /\bv0\b/);
    assert.match(result.stdout, /\blatest\b/);
    assert.match(result.stdout, LINE_0_MANIFEST_PATTERN);
    assert.match(result.stdout, /^breaking-commit: allow$/m);
    assert.match(result.stdout, /^protected-path: allow$/m);
    assertPackedDryRun(result.stdout);
    assertNoLocalSideEffects(packageBefore, tagsBefore, tarballsBefore);
  });

  it('exits non-zero for feat!: with no publishable version', () => {
    const result = runReleaseDryRun({
      releaseLine: '0',
      commitMessage: 'feat!: example',
    });
    assert.notEqual(result.status, 0);
    assert.equal(typeof result.status, 'number');
    assert.match(result.stdout, /^breaking-commit: refuse$/m);
    assert.match(result.stdout, LINE_0_MANIFEST_PATTERN);
    assert.doesNotMatch(result.stdout, /\bversion:\s*\d+\.\d+\.\d+\b/);
    assert.doesNotMatch(result.stdout, /\b0\.7\.0\b/);
    assert.doesNotMatch(result.stdout, /\b1\.0\.0\b/);
    assertNoLocalSideEffects(packageBefore, tagsBefore, tarballsBefore);
  });

  it('exits non-zero for a BREAKING CHANGE footer with no publishable version', () => {
    const result = runReleaseDryRun({
      releaseLine: '0',
      commitMessage: 'feat: example\n\nBREAKING CHANGE: shapes',
    });
    assert.notEqual(result.status, 0);
    assert.equal(typeof result.status, 'number');
    assert.match(result.stdout, /^breaking-commit: refuse$/m);
    assert.match(result.stdout, LINE_0_MANIFEST_PATTERN);
    assert.doesNotMatch(result.stdout, /\bversion:\s*\d+\.\d+\.\d+\b/);
    assert.doesNotMatch(result.stdout, /\b0\.7\.0\b/);
    assert.doesNotMatch(result.stdout, /\b1\.0\.0\b/);
    assertNoLocalSideEffects(packageBefore, tagsBefore, tarballsBefore);
  });
});
