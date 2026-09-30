import assert from 'node:assert/strict';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'vitest';
import {
  assertNoLocalSideEffects,
  assertPackedDryRun,
  CORE_STATE_RELAY_SKIPPED_PATTERN,
  EXPECTED_ZK_RANGE,
  LINE_0_MANIFEST_PATTERN,
  LINE_0_SELECTED_PATTERN,
  LINE_1_MANIFEST_PATTERN,
  listGitTags,
  packageJsonPath,
  readZkSdkRange,
  root,
  runReleaseDryRun,
  STELLAR_SELECTED_PATTERN,
  tarballCount,
} from './release-dry-run-helpers.js';

describe('release-dry-run line 0 plan', { timeout: 30_000 }, () => {
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
    assert.match(result.stdout, /dist-tags: sdk-v0 latest/);
    assert.match(result.stdout, /\blatest\b/);
    assert.match(result.stdout, LINE_0_MANIFEST_PATTERN);
    assert.match(result.stdout, LINE_0_SELECTED_PATTERN);
    assert.match(result.stdout, /privacy-sdk-core/);
    assert.match(result.stdout, /privacy-sdk-relay/);
    assert.match(result.stdout, /privacy-sdk-state/);
    assert.doesNotMatch(result.stdout, CORE_STATE_RELAY_SKIPPED_PATTERN);
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
    assert.match(result.stdout, /dist-tags: sdk-v0 latest/);
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
    assert.doesNotMatch(result.stdout, /\bversion:\s*\d+\.\d+\.\d+/);
    assert.doesNotMatch(result.stdout, /\bversion:\s*0\.7\.0\b/);
    assert.doesNotMatch(result.stdout, /\bversion:\s*1\.0\.0\b/);
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
    assert.doesNotMatch(result.stdout, /\bversion:\s*\d+\.\d+\.\d+/);
    assert.doesNotMatch(result.stdout, /\bversion:\s*0\.7\.0\b/);
    assert.doesNotMatch(result.stdout, /\bversion:\s*1\.0\.0\b/);
    assertNoLocalSideEffects(packageBefore, tagsBefore, tarballsBefore);
  });

  it('skips a non-release commit without selecting a version', () => {
    const result = runReleaseDryRun({
      releaseLine: '0',
      commitMessage: 'chore: release',
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /^release: skip$/m);
    assert.doesNotMatch(result.stdout, /\bversion:\s*\d+/);
    assert.doesNotMatch(result.stdout, /\bnpm publish\b/);
    assertNoLocalSideEffects(packageBefore, tagsBefore, tarballsBefore);
  });

  it('does not let release-please choose or bump versions on development or v1', () => {
    const workflowsDirectory = path.join(root, '.github/workflows');
    const workflowFiles = readdirSync(workflowsDirectory).filter((name) =>
      /\.ya?ml$/i.test(name),
    );
    assert.ok(workflowFiles.length > 0, 'expected release workflows');
    for (const name of workflowFiles) {
      const body = readFileSync(path.join(workflowsDirectory, name), 'utf8');
      assert.doesNotMatch(
        body,
        /googleapis\/release-please-action/,
        `${name} must not run release-please beside the release script`,
      );
      assert.doesNotMatch(
        body,
        /\brelease-please\b/,
        `${name} must not invoke release-please on development or v1`,
      );
    }
  });

  it('publish mode applies the script-selected version without npm publish', () => {
    try {
      const result = runReleaseDryRun({
        releaseLine: '0',
        commitMessage: 'fix: example',
        dryRun: '0',
      });
      assert.equal(result.status, 0, result.stderr || result.stdout);
      assert.match(result.stdout, /\bversion:\s*0\.6\.2\b/);
      assert.match(result.stdout, /dist-tags: sdk-v0 latest/);
      assert.match(result.stdout, LINE_0_SELECTED_PATTERN);
      assert.match(result.stdout, /^mode: publish$/m);
      assert.match(result.stdout, /skipped:.*npm publish/i);
      assert.doesNotMatch(result.stdout, /packed current package tree/);
      assert.doesNotMatch(result.stdout, /^Would publish /m);
      const applied = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
        version: string;
        dependencies: Record<string, string>;
      };
      assert.equal(applied.version, '0.6.2');
      assert.equal(
        applied.dependencies['@arcanetech/stellar-privacy-pool-zk-sdk'],
        EXPECTED_ZK_RANGE,
      );
      assert.equal(listGitTags(), tagsBefore);
      assert.equal(tarballCount(), tarballsBefore);
    } finally {
      writeFileSync(packageJsonPath, packageBefore);
    }
    assertNoLocalSideEffects(packageBefore, tagsBefore, tarballsBefore);
  });

  it('after stable 1.x exists, prints dist-tag v0 and does not take latest', () => {
    const result = runReleaseDryRun({
      releaseLine: '0',
      commitMessage: 'fix: example',
      stable1xPublished: '1',
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /\bversion:\s*0\.6\.2\b/);
    assert.match(result.stdout, /dist-tags: sdk-v0$/m);
    assert.doesNotMatch(result.stdout, /\blatest\b/);
    assert.match(result.stdout, LINE_0_MANIFEST_PATTERN);
    assertPackedDryRun(result.stdout);
    assertNoLocalSideEffects(packageBefore, tagsBefore, tarballsBefore);
  });
});

describe('release-dry-run line 1 plan', { timeout: 30_000 }, () => {
  const packageBefore = readFileSync(packageJsonPath, 'utf8');
  const tagsBefore = listGitTags();
  const tarballsBefore = tarballCount();

  it('before promotion prints 1.0.0-rc.0, dist-tag next, and line-1 zk range', () => {
    const result = runReleaseDryRun({
      releaseLine: '1',
      commitMessage: 'feat!: shapes',
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /\bversion:\s*1\.0\.0-rc\.0\b/);
    assert.match(result.stdout, /\bnext\b/);
    assert.doesNotMatch(result.stdout, /\blatest\b/);
    assert.match(result.stdout, /^zk-sdk-range:\s*>=1\.0\.0 <2\.0\.0$/m);
    assert.match(result.stdout, LINE_1_MANIFEST_PATTERN);
    assert.match(result.stdout, STELLAR_SELECTED_PATTERN);
    assert.match(result.stdout, CORE_STATE_RELAY_SKIPPED_PATTERN);
    assert.match(result.stdout, /privacy-sdk-core/);
    assert.match(result.stdout, /privacy-sdk-relay/);
    assert.match(result.stdout, /privacy-sdk-state/);
    assert.match(result.stdout, /^breaking-commit: allow$/m);
    assert.match(result.stdout, /^protected-path: allow$/m);
    assertPackedDryRun(result.stdout);
    assertNoLocalSideEffects(packageBefore, tagsBefore, tarballsBefore);
  });

  it('manual promotion prints stable 1.0.0 and dist-tag latest', () => {
    const result = runReleaseDryRun({
      releaseLine: '1',
      commitMessage: 'chore: promote',
      promoteStable: '1',
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /\bversion:\s*1\.0\.0\b/);
    assert.doesNotMatch(result.stdout, /\b1\.0\.0-rc\./);
    assert.match(result.stdout, /\blatest\b/);
    assert.doesNotMatch(result.stdout, /\bnext\b/);
    assert.doesNotMatch(result.stdout, /\bv0\b/);
    assert.match(result.stdout, /^zk-sdk-range:\s*>=1\.0\.0 <2\.0\.0$/m);
    assert.match(result.stdout, LINE_1_MANIFEST_PATTERN);
    assert.match(result.stdout, STELLAR_SELECTED_PATTERN);
    assert.match(result.stdout, CORE_STATE_RELAY_SKIPPED_PATTERN);
    assertPackedDryRun(result.stdout);
    assertNoLocalSideEffects(packageBefore, tagsBefore, tarballsBefore);
  });
});
