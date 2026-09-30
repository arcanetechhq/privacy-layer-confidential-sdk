import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'vitest';
import {
  assertNoLocalSideEffects,
  assertPackedDryRun,
  createMergeFixture,
  listGitTags,
  packageJsonPath,
  RELEASE_MANIFEST,
  runReleaseDryRun,
  STELLAR_PACKAGE_JSON,
  stellarPackageJson,
  tarballCount,
} from './release-dry-run-helpers.js';

describe('release-dry-run protected merge verdict', { timeout: 30_000 }, () => {
  const packageBefore = readFileSync(packageJsonPath, 'utf8');
  const tagsBefore = listGitTags();
  const tarballsBefore = tarballCount();

  it('exits non-zero and names the path when merge would replace the release manifest', () => {
    const fixture = createMergeFixture({
      line0(files) {
        files[RELEASE_MANIFEST] = '{"circuits":{"main":{"version":"0.x"}}}\n';
      },
      line1(files) {
        files[RELEASE_MANIFEST] = '{"circuits":{"main":{"version":"1.x"}}}\n';
        files['packages/stellar/src/unprotected.ts'] = 'line1 only change\n';
      },
    });
    try {
      const result = runReleaseDryRun({
        releaseLine: '1',
        commitMessage: 'fix: example',
        mergeFrom: fixture.line0,
        mergeInto: fixture.line1,
        mergeRepo: fixture.directory,
      });
      assert.notEqual(result.status, 0, result.stdout);
      assert.equal(typeof result.status, 'number');
      assert.match(result.stdout, /protected-path: refuse release manifest/i);
      assert.doesNotMatch(result.stdout, /\.tgz\b/);
      assertNoLocalSideEffects(packageBefore, tagsBefore, tarballsBefore);
    } finally {
      fixture.cleanup();
    }
  });

  it('exits zero when the merge only brings clean changes to unprotected SDK code', () => {
    const fixture = createMergeFixture({
      line0(files) {
        files['packages/stellar/src/unprotected.ts'] = 'fix from line0\n';
      },
    });
    try {
      const result = runReleaseDryRun({
        releaseLine: '1',
        commitMessage: 'fix: example',
        mergeFrom: fixture.line0,
        mergeInto: fixture.line1,
        mergeRepo: fixture.directory,
      });
      assert.equal(result.status, 0, result.stderr || result.stdout);
      assert.match(result.stdout, /^protected-path: allow$/m);
      assertPackedDryRun(result.stdout);
      assertNoLocalSideEffects(packageBefore, tagsBefore, tarballsBefore);
    } finally {
      fixture.cleanup();
    }
  });

  it('exits non-zero on unprotected conflict and does not choose either side', () => {
    const fixture = createMergeFixture({
      line0(files) {
        files['packages/stellar/src/unprotected.ts'] = 'line0 unprotected\n';
      },
      line1(files) {
        files['packages/stellar/src/unprotected.ts'] = 'line1 unprotected\n';
      },
    });
    try {
      const beforeUnprotected = readFileSync(
        path.join(fixture.directory, 'packages/stellar/src/unprotected.ts'),
        'utf8',
      );
      const result = runReleaseDryRun({
        releaseLine: '1',
        commitMessage: 'fix: example',
        mergeFrom: fixture.line0,
        mergeInto: fixture.line1,
        mergeRepo: fixture.directory,
      });
      assert.notEqual(result.status, 0, result.stdout);
      assert.equal(typeof result.status, 'number');
      assert.match(result.stdout, /^protected-path: allow$/m);
      assert.match(result.stdout, /^merge: conflict$/m);
      assert.doesNotMatch(result.stdout, /protected-path: refuse/);
      assert.doesNotMatch(result.stdout, /\.tgz\b/);
      assert.equal(
        readFileSync(
          path.join(fixture.directory, 'packages/stellar/src/unprotected.ts'),
          'utf8',
        ),
        beforeUnprotected,
      );
      assertNoLocalSideEffects(packageBefore, tagsBefore, tarballsBefore);
    } finally {
      fixture.cleanup();
    }
  });

  it('exits non-zero and names package version when the 0.x copy would win', () => {
    const fixture = createMergeFixture({
      line0(files) {
        files[STELLAR_PACKAGE_JSON] = stellarPackageJson('0.6.2', '>=1.0.0 <2.0.0');
      },
    });
    try {
      const result = runReleaseDryRun({
        releaseLine: '1',
        commitMessage: 'fix: example',
        mergeFrom: fixture.line0,
        mergeInto: fixture.line1,
        mergeRepo: fixture.directory,
      });
      assert.notEqual(result.status, 0, result.stdout);
      assert.match(result.stdout, /protected-path: refuse package version/i);
      assert.doesNotMatch(result.stdout, /\.tgz\b/);
      assertNoLocalSideEffects(packageBefore, tagsBefore, tarballsBefore);
    } finally {
      fixture.cleanup();
    }
  });

  it('exits non-zero and names zk SDK dependency range when the 0.x copy would win', () => {
    const fixture = createMergeFixture({
      line0(files) {
        files[STELLAR_PACKAGE_JSON] = stellarPackageJson(
          '1.0.0-rc.0',
          '>=0.11.0 <1.0.0',
        );
      },
      line1(files) {
        files[STELLAR_PACKAGE_JSON] = stellarPackageJson(
          '1.0.0-rc.0',
          '>=1.0.0 <2.0.0',
        );
      },
    });
    try {
      const result = runReleaseDryRun({
        releaseLine: '1',
        commitMessage: 'fix: example',
        mergeFrom: fixture.line0,
        mergeInto: fixture.line1,
        mergeRepo: fixture.directory,
      });
      assert.notEqual(result.status, 0, result.stdout);
      assert.match(result.stdout, /protected-path: refuse zk SDK dependency range/i);
      assert.doesNotMatch(result.stdout, /\.tgz\b/);
      assertNoLocalSideEffects(packageBefore, tagsBefore, tarballsBefore);
    } finally {
      fixture.cleanup();
    }
  });

  it('allows package.json merges that do not replace version or zk range', () => {
    const fixture = createMergeFixture({
      line0(files) {
        files[STELLAR_PACKAGE_JSON] = stellarPackageJson(
          '1.0.0-rc.0',
          '>=1.0.0 <2.0.0',
          ',\n  "description": "from line0 only"',
        );
      },
    });
    try {
      const result = runReleaseDryRun({
        releaseLine: '1',
        commitMessage: 'fix: example',
        mergeFrom: fixture.line0,
        mergeInto: fixture.line1,
        mergeRepo: fixture.directory,
      });
      assert.equal(result.status, 0, result.stderr || result.stdout);
      assert.match(result.stdout, /^protected-path: allow$/m);
      assertPackedDryRun(result.stdout);
      assertNoLocalSideEffects(packageBefore, tagsBefore, tarballsBefore);
    } finally {
      fixture.cleanup();
    }
  });
});
