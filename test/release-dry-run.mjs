import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const script = resolve(root, "scripts/release-dry-run.sh");
const packageJsonPath = resolve(root, "packages/stellar/package.json");
const ZK_SDK_DEP = "@arcanetech/stellar-privacy-pool-zk-sdk";
const EXPECTED_ZK_RANGE = ">=0.11.0 <1.0.0";

function runReleaseDryRun({ releaseLine, commitMessage } = {}) {
  return spawnSync(script, [], {
    cwd: root,
    encoding: "utf8",
    env: {
      ...process.env,
      DRY_RUN: "1",
      RELEASE_LINE: releaseLine,
      COMMIT_MESSAGE: commitMessage,
    },
  });
}

function tarballCount() {
  const roots = [root, resolve(root, "packages/stellar")];
  let count = 0;
  for (const dir of roots) {
    count += readdirSync(dir).filter((name) => name.endsWith(".tgz")).length;
  }
  return count;
}

const packageBefore = readFileSync(packageJsonPath, "utf8");
const tagsBefore = spawnSync("git", ["tag", "--list"], {
  cwd: root,
  encoding: "utf8",
}).stdout;
const tarballsBefore = tarballCount();

function assertNoLocalSideEffects() {
  const after = readFileSync(packageJsonPath, "utf8");
  assert.equal(after, packageBefore);
  const parsed = JSON.parse(after);
  assert.equal(parsed.version, "0.6.1");
  assert.equal(parsed.dependencies[ZK_SDK_DEP], EXPECTED_ZK_RANGE);
  assert.equal(
    spawnSync("git", ["tag", "--list"], { cwd: root, encoding: "utf8" }).stdout,
    tagsBefore,
  );
  assert.equal(tarballCount(), tarballsBefore);
}

function assertLine0SuccessPlan(result, expectedVersion) {
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(
    result.stdout,
    new RegExp(`\\bversion:\\s*${expectedVersion.replaceAll(".", "\\.")}\\b`),
  );
  assert.match(result.stdout, /\bv0\b/);
  assert.match(result.stdout, /\blatest\b/);
  assert.match(result.stdout, /^breaking-commit: allow$/m);
  assert.match(result.stdout, /^protected-path: allow$/m);
  assert.match(result.stdout, /\.tgz\b/);
  assert.match(result.stdout, /packed.*skipped publish/i);
  assert.doesNotMatch(result.stdout, /\bnpm publish\b/);
  assertNoLocalSideEffects();
}

function assertLine0BreakingRefusal(result) {
  assert.notEqual(result.status, 0);
  assert.notEqual(result.status, null);
  assert.match(result.stdout, /^breaking-commit: refuse$/m);
  assert.doesNotMatch(result.stdout, /\bversion:\s*\d+\.\d+\.\d+\b/);
  assert.doesNotMatch(result.stdout, /\b0\.7\.0\b/);
  assert.doesNotMatch(result.stdout, /\b1\.0\.0\b/);
  assertNoLocalSideEffects();
}

{
  const parsed = JSON.parse(packageBefore);
  assert.equal(parsed.version, "0.6.1");
  assert.equal(parsed.dependencies[ZK_SDK_DEP], EXPECTED_ZK_RANGE);
}

assertLine0SuccessPlan(
  runReleaseDryRun({ releaseLine: "0", commitMessage: "fix: example" }),
  "0.6.2",
);
assertLine0SuccessPlan(
  runReleaseDryRun({ releaseLine: "0", commitMessage: "feat: example" }),
  "0.7.0",
);
assertLine0BreakingRefusal(
  runReleaseDryRun({ releaseLine: "0", commitMessage: "feat!: example" }),
);
assertLine0BreakingRefusal(
  runReleaseDryRun({
    releaseLine: "0",
    commitMessage: "feat: example\n\nBREAKING CHANGE: shapes",
  }),
);

console.log("release-dry-run line 0 plan ok");
