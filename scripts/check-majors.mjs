import { readdirSync, readFileSync } from 'node:fs';
import { getPackages } from '@manypkg/get-packages';
import semver from 'semver';
import { isDirectRun, readCurrentBranch } from './git-branch.mjs';

export const STELLAR_PACKAGE = '@arcanetech/privacy-sdk-stellar';
export const ZK_SDK_PACKAGE = '@arcanetech/stellar-privacy-pool-zk-sdk';
const ZERO_RANGE = '>=0.0.0 <1.0.0';
const AT_LEAST_ONE = '>=1.0.0';

export function resolveBranchRef(env, currentBranch) {
  const ref = env.GITHUB_BASE_REF || env.GITHUB_REF_NAME || currentBranch || '';
  if (!ref || ref === 'HEAD') {
    throw new Error('Could not determine the release branch.');
  }
  return ref;
}

export function expectedMajorForRef(ref) {
  if (ref === 'main') {
    return;
  }
  const match = /^release\/v(\d+)$/.exec(ref);
  if (!match) {
    throw new Error(`Unsupported release branch: ${ref}`);
  }
  return Number(match[1]);
}

function bumpLevel(line) {
  const separator = line.indexOf(':');
  if (separator === -1) {
    return '';
  }
  return line
    .slice(separator + 1)
    .trim()
    .replaceAll(/["']/g, '');
}

export function changesetDeclaresMajor(source) {
  const frontmatter = source.split('---')[1] ?? '';
  return frontmatter.split('\n').some((line) => bumpLevel(line) === 'major');
}

export function zkSdkRangeError(range) {
  if (typeof range !== 'string' || !semver.validRange(range)) {
    return 'Stellar zk-sdk range must stay inside major 0.';
  }
  const allowsZero = semver.intersects(range, ZERO_RANGE);
  const allowsHigher = semver.intersects(range, AT_LEAST_ONE);
  if (!allowsZero || allowsHigher) {
    return `Stellar zk-sdk range must stay inside major 0, found: ${range}`;
  }
}

function majorOf(version) {
  const [head] = String(version).split('.');
  const major = Number(head);
  return Number.isInteger(major) ? major : undefined;
}

function appendPackageErrors(expected, packages, errors) {
  const majors = new Set();
  for (const workspacePackage of packages.filter((item) => !item.private)) {
    const major = majorOf(workspacePackage.version);
    if (major === undefined) {
      errors.push(
        `${workspacePackage.name}: invalid version ${workspacePackage.version}`,
      );
      continue;
    }
    majors.add(major);
    if (expected !== undefined && major !== expected) {
      errors.push(
        `${workspacePackage.name}@${workspacePackage.version}: expected major ${expected}`,
      );
    }
  }
  if (expected === undefined && majors.size > 1) {
    errors.push(`main: packages have different majors: ${[...majors].join(', ')}`);
  }
}

function appendChangesetErrors(expected, ref, changesets, errors) {
  if (expected === undefined) {
    return;
  }
  for (const file of changesets) {
    if (changesetDeclaresMajor(file.source)) {
      errors.push(`${file.name}: major changes are not allowed on ${ref}`);
    }
  }
}

export function collectReleaseErrors({ ref, packages, changesets, zkSdkRange }) {
  const expected = expectedMajorForRef(ref);
  const errors = [];
  appendPackageErrors(expected, packages, errors);
  appendChangesetErrors(expected, ref, changesets, errors);
  if (expected === 0) {
    const zkError = zkSdkRangeError(zkSdkRange);
    if (zkError) {
      errors.push(zkError);
    }
  }
  return errors;
}

function readChangesets() {
  return readdirSync('.changeset')
    .filter((name) => name.endsWith('.md') && name !== 'README.md')
    .map((name) => ({
      name: `.changeset/${name}`,
      source: readFileSync(`.changeset/${name}`, 'utf8'),
    }));
}

function describePackages(packages) {
  return packages.map((workspacePackage) => ({
    name: workspacePackage.packageJson.name,
    version: workspacePackage.packageJson.version,
    private: workspacePackage.packageJson.private === true,
    dependencies: workspacePackage.packageJson.dependencies ?? {},
  }));
}

function readZkSdkRange(packages) {
  const stellar = packages.find((item) => item.name === STELLAR_PACKAGE);
  const dependencies = stellar?.dependencies;
  if (
    !dependencies ||
    !Object.hasOwn(dependencies, '@arcanetech/stellar-privacy-pool-zk-sdk')
  ) {
    return;
  }
  return dependencies['@arcanetech/stellar-privacy-pool-zk-sdk'];
}

export async function evaluateReleaseBranch(root, env, currentBranch) {
  const ref = resolveBranchRef(env, currentBranch);
  const { packages } = await getPackages(root);
  const described = describePackages(packages);
  return collectReleaseErrors({
    ref,
    packages: described,
    changesets: readChangesets(),
    zkSdkRange: readZkSdkRange(described),
  });
}

async function main() {
  const errors = await evaluateReleaseBranch(
    process.cwd(),
    process.env,
    readCurrentBranch(),
  );
  if (errors.length > 0) {
    throw new Error(errors.join('\n'));
  }
}

if (isDirectRun(import.meta.url)) {
  await main();
}
