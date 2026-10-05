import { describe, expect, it } from 'vitest';
import {
  changesetDeclaresMajor,
  collectReleaseErrors,
  expectedMajorForRef,
  zkSdkRangeError,
} from './check-majors.mjs';
import {
  assertMajorChangesetAllowed,
  renderMajorChangeset,
} from './major-changeset.mjs';
import { publishEnvironment, resolveDistributionTag } from './publish.mjs';
import { withBaseBranch } from './set-changesets-base-branch.mjs';

const core = { name: '@arcanetech/privacy-sdk-core', version: '0.3.1', private: false };
const stellar = {
  name: '@arcanetech/privacy-sdk-stellar',
  version: '0.6.2',
  private: false,
};
const hidden = { name: 'privacy-layer-sdk', version: '0.0.0', private: true };
const zeroRange = '>=0.11.0 <1.0.0';

function quotedMajor(level: string): string {
  return `---\n"@arcanetech/privacy-sdk-core": ${level}\n---\n\nNote\n`;
}

describe('changeset frontmatter', () => {
  it('detects a quoted major bump', () => {
    expect(changesetDeclaresMajor(quotedMajor('major'))).toBe(true);
  });

  it('detects an unquoted major bump', () => {
    const source = "---\n'@arcanetech/privacy-sdk-core': major\n---\n";
    expect(changesetDeclaresMajor(source)).toBe(true);
  });

  it('ignores minor and patch bumps', () => {
    expect(changesetDeclaresMajor(quotedMajor('minor'))).toBe(false);
    expect(changesetDeclaresMajor(quotedMajor('patch'))).toBe(false);
  });

  it('detects major when another package is patch', () => {
    const source = [
      '---',
      '"@arcanetech/privacy-sdk-core": patch',
      '"@arcanetech/privacy-sdk-stellar": major',
      '---',
    ].join('\n');
    expect(changesetDeclaresMajor(source)).toBe(true);
  });
});

describe('release major invariant', () => {
  it('accepts major 0 packages on release/v0', () => {
    const errors = collectReleaseErrors({
      ref: 'release/v0',
      packages: [core, stellar, hidden],
      changesets: [],
      zkSdkRange: zeroRange,
    });
    expect(errors).toEqual([]);
  });

  it('rejects a package whose major is not the branch major', () => {
    const errors = collectReleaseErrors({
      ref: 'release/v0',
      packages: [core, { ...stellar, version: '2.0.0' }],
      changesets: [],
      zkSdkRange: zeroRange,
    });
    expect(errors).toContain('@arcanetech/privacy-sdk-stellar@2.0.0: expected major 0');
  });

  it('rejects a major changeset on a release branch', () => {
    const errors = collectReleaseErrors({
      ref: 'release/v1',
      packages: [
        { ...core, version: '1.0.0' },
        { ...stellar, version: '1.0.0' },
      ],
      changesets: [{ name: '.changeset/break.md', source: quotedMajor('major') }],
      zkSdkRange: zeroRange,
    });
    expect(errors).toContain(
      '.changeset/break.md: major changes are not allowed on release/v1',
    );
  });

  it('requires one shared major on main', () => {
    const errors = collectReleaseErrors({
      ref: 'main',
      packages: [core, { ...stellar, version: '1.0.0' }],
      changesets: [],
      zkSdkRange: zeroRange,
    });
    expect(errors.some((error) => error.startsWith('main:'))).toBe(true);
  });

  it('rejects an unknown branch instead of treating it as main', () => {
    expect(() => expectedMajorForRef('development')).toThrow(
      'Unsupported release branch: development',
    );
  });
});

describe('release/v0 zk-sdk range', () => {
  it('accepts a range inside major 0', () => {
    expect(zkSdkRangeError(zeroRange)).toBeUndefined();
  });

  it('rejects a range that includes 1.0.0', () => {
    const errors = collectReleaseErrors({
      ref: 'release/v0',
      packages: [core, stellar],
      changesets: [],
      zkSdkRange: '>=0.11.0 <2.0.0',
    });
    expect(errors.some((error) => error.includes('major 0'))).toBe(true);
    expect(zkSdkRangeError('>=0.11.0')).not.toBeNull();
    expect(zkSdkRangeError('^1.0.0')).not.toBeNull();
  });

  it('does not apply the zk-sdk lock on release/v1', () => {
    const errors = collectReleaseErrors({
      ref: 'release/v1',
      packages: [
        { ...core, version: '1.0.0' },
        { ...stellar, version: '1.0.0' },
      ],
      changesets: [],
      zkSdkRange: '>=1.0.0 <2.0.0',
    });
    expect(errors).toEqual([]);
  });
});

describe('dist tag', () => {
  it('uses release-vN for a release branch and latest for main', () => {
    expect(resolveDistributionTag('release/v0')).toBe('release-v0');
    expect(resolveDistributionTag('release/v1')).toBe('release-v1');
    expect(resolveDistributionTag('main')).toBe('latest');
  });

  it('refuses to publish from any other branch', () => {
    expect(() => resolveDistributionTag('development')).toThrow(
      'Unsupported release branch: development',
    );
  });

  it('omits npm tokens so publish uses trusted publishing', () => {
    const previousAuth = process.env.NODE_AUTH_TOKEN;
    const previousNpm = process.env.NPM_TOKEN;
    process.env.NODE_AUTH_TOKEN = 'placeholder';
    process.env.NPM_TOKEN = 'placeholder';
    const env = publishEnvironment();
    if (previousAuth === undefined) {
      delete process.env.NODE_AUTH_TOKEN;
    } else {
      process.env.NODE_AUTH_TOKEN = previousAuth;
    }
    if (previousNpm === undefined) {
      delete process.env.NPM_TOKEN;
    } else {
      process.env.NPM_TOKEN = previousNpm;
    }
    expect(env.NODE_AUTH_TOKEN).toBeUndefined();
    expect(env.NPM_TOKEN).toBeUndefined();
    expect(env.PATH).toBe(process.env.PATH);
  });
});

describe('major changeset', () => {
  it('lists every public package as major', () => {
    expect(renderMajorChangeset(['@arcanetech/privacy-sdk-core'])).toContain(
      '"@arcanetech/privacy-sdk-core": major',
    );
  });

  it('refuses to run on a release branch', () => {
    expect(() => assertMajorChangesetAllowed('release/v0')).toThrow(/release\/v0/);
    expect(() => assertMajorChangesetAllowed('main')).not.toThrow();
  });
});

describe('changesets base branch', () => {
  it('sets baseBranch to the release branch', () => {
    expect(withBaseBranch({ access: 'public' }, 'release/v0')).toEqual({
      access: 'public',
      baseBranch: 'release/v0',
    });
  });

  it('rejects a branch that is not main or release/vN', () => {
    expect(() => withBaseBranch({}, 'development')).toThrow(/development/);
  });
});
