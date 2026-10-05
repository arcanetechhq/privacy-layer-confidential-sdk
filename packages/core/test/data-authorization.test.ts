import { describe, expect, it } from 'vitest';
import { authorizePrivateData, type DataAuthorizer } from '../src/index.js';

const CHALLENGE = {
  protocol: 'example.protocol',
  message: 'sign-this-challenge',
  fields: { account: 'acct-1' },
};

const PROOF = {
  protocol: 'example.protocol',
  fields: { signature: 'sig-1', signer: 'acct-1' },
};

describe('authorizePrivateData', () => {
  it('rejects a challenge that misses the wide envelope before authorize runs', async () => {
    let authorized = false;
    const authorizer: DataAuthorizer = {
      async authorize() {
        authorized = true;
        return PROOF;
      },
    };

    await expect(
      authorizePrivateData(authorizer, { protocol: 'example.protocol', fields: {} }),
    ).rejects.toThrow();
    expect(authorized).toBe(false);
  });

  it('rejects a proof that misses the wide envelope', async () => {
    const authorizer: DataAuthorizer = {
      async authorize() {
        return { protocol: '', fields: { signature: 'sig-1' } };
      },
    };

    await expect(authorizePrivateData(authorizer, CHALLENGE)).rejects.toThrow();
  });

  it('returns the proof after the wide envelope accepts it', async () => {
    const authorizer: DataAuthorizer = {
      async authorize(challenge) {
        expect(challenge).toEqual(CHALLENGE);
        return { ...PROOF, extra: 'drop-me' };
      },
    };

    await expect(authorizePrivateData(authorizer, CHALLENGE)).resolves.toEqual(PROOF);
  });
});
