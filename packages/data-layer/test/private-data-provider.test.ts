import { describe, expect, it } from 'vitest';
import type { DataAuthorizationChallenge } from '@arcanetech/privacy-sdk-core';
import { z } from 'zod';
import { createPrivateDataProvider } from '../src/index.js';

const recordSchema = z.object({ id: z.string() });
const completionSchema = z.object({
  tags: z.array(z.object({ epoch: z.number(), tag: z.string() })),
});

describe('createPrivateDataProvider', () => {
  it('rejects a challenge that misses the wide envelope before HTTP', async () => {
    const requests: string[] = [];
    let authorized = false;
    const provider = createPrivateDataProvider({
      origin: 'https://private-data.example',
      dataType: 'example.record',
      recordSchema,
      completionSchema,
      protocol: 'example.protocol',
      authorizer: {
        async authorize() {
          authorized = true;
          return {
            protocol: 'example.protocol',
            fields: { signature: 'sig-1' },
          };
        },
      },
      fetch: async (input) => {
        requests.push(String(input));
        return Response.json([]);
      },
    });

    await expect(
      provider.completeChallenge({
        protocol: 'example.protocol',
        fields: {},
      } as DataAuthorizationChallenge),
    ).rejects.toThrow();
    expect(requests).toEqual([]);
    expect(authorized).toBe(false);
  });

  it('fails closed when the completion payload misses the caller schema', async () => {
    const requests: string[] = [];
    const provider = createPrivateDataProvider({
      origin: 'https://private-data.example',
      dataType: 'example.record',
      recordSchema,
      completionSchema,
      protocol: 'example.protocol',
      authorizer: {
        async authorize() {
          return {
            protocol: 'example.protocol',
            fields: { signature: 'sig-1' },
          };
        },
      },
      fetch: async (input) => {
        requests.push(String(input));
        return Response.json({ tags: [{ epoch: '4', tag: 'tag-4' }] });
      },
    });

    await expect(
      provider.completeChallenge({
        protocol: 'example.protocol',
        message: 'sign-this',
        fields: { account: 'acct-1' },
      }),
    ).rejects.toThrow(/number/);
    expect(requests).toEqual([
      'https://private-data.example/authorization-completions',
    ]);
  });

  it('fails closed when a find payload misses the caller schema', async () => {
    const requests: string[] = [];
    const provider = createPrivateDataProvider({
      origin: 'https://private-data.example/',
      dataType: 'example.record',
      recordSchema,
      fetch: async (input) => {
        requests.push(String(input));
        return Response.json([{ id: 1 }]);
      },
    });

    await expect(provider.find({ account: 'acct-1' })).rejects.toThrow(/string/);
    expect(requests).toEqual(['https://private-data.example/records']);
  });

  it('returns a challenge only after the wide envelope accepts the response', async () => {
    const bodies: unknown[] = [];
    const provider = createPrivateDataProvider({
      origin: 'https://private-data.example',
      dataType: 'example.record',
      recordSchema,
      completionSchema,
      protocol: 'example.protocol',
      fetch: async (_input, init) => {
        bodies.push(JSON.parse(String(init?.body)));
        return Response.json({
          protocol: 'example.protocol',
          message: 'sign-this',
          fields: { account: 'acct-1' },
        });
      },
    });

    await expect(provider.createChallenge({ account: 'acct-1' })).resolves.toEqual({
      protocol: 'example.protocol',
      message: 'sign-this',
      fields: { account: 'acct-1' },
    });
    expect(bodies).toEqual([
      {
        dataType: 'example.record',
        protocol: 'example.protocol',
        fields: { account: 'acct-1' },
      },
    ]);
  });
});

describe('createPrivateDataProvider challenge gates', () => {
  it('stops challenge methods before HTTP when completion is not configured', async () => {
    const requests: string[] = [];
    let authorized = false;
    const provider = createPrivateDataProvider({
      origin: 'https://private-data.example',
      dataType: 'example.record',
      recordSchema,
      protocol: 'example.protocol',
      authorizer: {
        async authorize() {
          authorized = true;
          return { protocol: 'example.protocol', fields: { signature: 'sig-1' } };
        },
      },
      fetch: async (input) => {
        requests.push(String(input));
        return Response.json({});
      },
    });

    await expect(provider.createChallenge({ account: 'acct-1' })).rejects.toThrow(
      /completion is not configured/,
    );
    await expect(
      provider.completeChallenge({
        protocol: 'example.protocol',
        message: 'sign-this',
        fields: { account: 'acct-1' },
      }),
    ).rejects.toThrow(/completion is not configured/);
    expect(requests).toEqual([]);
    expect(authorized).toBe(false);
  });

  it('rejects a proof that misses the wide envelope before HTTP', async () => {
    const requests: string[] = [];
    const provider = createPrivateDataProvider({
      origin: 'https://private-data.example',
      dataType: 'example.record',
      recordSchema,
      completionSchema,
      protocol: 'example.protocol',
      authorizer: {
        async authorize() {
          return { protocol: '', fields: { signature: 'sig-1' } };
        },
      },
      fetch: async (input) => {
        requests.push(String(input));
        return Response.json({ tags: [] });
      },
    });

    await expect(
      provider.completeChallenge({
        protocol: 'example.protocol',
        message: 'sign-this',
        fields: { account: 'acct-1' },
      }),
    ).rejects.toThrow();
    expect(requests).toEqual([]);
  });

  it('returns find results only after the caller schema accepts them', async () => {
    let authorized = false;
    const bodies: unknown[] = [];
    const provider = createPrivateDataProvider({
      origin: 'https://private-data.example',
      dataType: 'example.record',
      recordSchema,
      authorizer: {
        async authorize() {
          authorized = true;
          return { protocol: 'example.protocol', fields: { signature: 'sig-1' } };
        },
      },
      fetch: async (_input, init) => {
        bodies.push(JSON.parse(String(init?.body)));
        return Response.json([{ id: 'record-1' }]);
      },
    });

    await expect(provider.find({ account: 'acct-1' })).resolves.toEqual([
      { id: 'record-1' },
    ]);
    expect(authorized).toBe(false);
    expect(bodies).toEqual([
      { dataType: 'example.record', attributes: { account: 'acct-1' } },
    ]);
  });

  it('returns a completion only after the caller schema accepts it', async () => {
    const bodies: unknown[] = [];
    const provider = createPrivateDataProvider({
      origin: 'https://private-data.example',
      dataType: 'example.record',
      recordSchema,
      completionSchema,
      protocol: 'example.protocol',
      authorizer: {
        async authorize(challenge) {
          return {
            protocol: 'example.protocol',
            fields: {
              account: challenge.fields.account ?? '',
              signature: 'sig-1',
              signerPublicKey: 'signer-1',
            },
          };
        },
      },
      fetch: async (_input, init) => {
        bodies.push(JSON.parse(String(init?.body)));
        return Response.json({ tags: [{ epoch: 4, tag: 'tag-4' }] });
      },
    });

    await expect(
      provider.completeChallenge({
        protocol: 'example.protocol',
        message: 'sign-this',
        fields: { account: 'acct-1' },
      }),
    ).resolves.toEqual({ tags: [{ epoch: 4, tag: 'tag-4' }] });
    expect(bodies).toEqual([
      {
        dataType: 'example.record',
        protocol: 'example.protocol',
        fields: {
          account: 'acct-1',
          signature: 'sig-1',
          signerPublicKey: 'signer-1',
        },
      },
    ]);
  });
});
