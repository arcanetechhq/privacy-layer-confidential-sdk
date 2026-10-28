import type { Plan } from '@arcanetech/privacy-sdk-automatization-plan';
import { Keypair } from '@stellar/stellar-sdk';
import { expect, it, vi } from 'vitest';
import {
  createPlanClient,
  createSecretDepositSigner,
  depositSigningMessage,
  planProgress,
  readPinnedPresence,
  waitingDeposit,
  type PoolView,
} from '../src/index.js';

const plan: Plan = {
  rows: [
    {
      kind: 'deposit',
      amount: 10n,
      step: {
        freeTokens: 2n,
        interval: 0n,
        pinnedInputs: [],
        pinnedOutputs: [
          {
            plaintext: { amount: 8n, accumulator: 'pin' },
            commitment: 'commitment-remainder',
            nullifierHash: 'nullifier-remainder',
          },
        ],
      },
    },
  ],
};

it('sends decimal amounts and reads a Plan back as bigint', async () => {
  const bodies: unknown[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.body) {
        bodies.push(JSON.parse(String(init.body)));
      }
      return Response.json(
        {
          rows: [
            {
              kind: 'deposit',
              amount: '10',
              step: {
                freeTokens: '2',
                interval: '0',
                pinnedInputs: [],
                pinnedOutputs: [],
              },
            },
          ],
        },
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
      );
    }),
  );

  const client = createPlanClient({ baseUrl: 'http://automation.test' });
  const composed = await client.compose([{ account: 'bob-account', amount: 30n }]);

  expect(bodies[0]).toEqual({ recipients: [{ account: 'bob-account', amount: '30' }] });
  expect(composed.rows[0]).toMatchObject({ kind: 'deposit', amount: 10n });
  vi.unstubAllGlobals();
});

it('treats a missing deposit signature as not waiting', async () => {
  const pool: PoolView = {
    merkleRoot: async () => 'root',
    isNullifierConsumed: async () => false,
    commitmentsInTree: async () => [],
  };
  const presence = await readPinnedPresence(plan, pool);
  const progress = planProgress(plan, presence);
  expect(waitingDeposit(plan, progress)).toBeUndefined();
  expect(
    waitingDeposit(plan, progress, {
      root: 'root',
      pinnedOutputCommitments: ['commitment-remainder'],
    }),
  ).toBe(0);
  expect(presence.outputCommitmentsInPoolTree).toEqual([]);
});

it('signs the deposit message with a Stellar secret key', async () => {
  const keypair = Keypair.random();
  const signer = createSecretDepositSigner({ secretKey: keypair.secret() });
  const invocation = {
    root: 'root',
    pinnedOutputCommitments: ['commitment-remainder'],
  };
  const signature = await signer.sign(invocation);
  expect(
    keypair.verify(
      Buffer.from(depositSigningMessage(invocation)),
      Buffer.from(signature, 'base64'),
    ),
  ).toBe(true);
});
