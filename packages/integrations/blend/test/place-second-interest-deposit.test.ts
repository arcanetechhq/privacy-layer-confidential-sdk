import { describe, expect, it } from 'vitest';
import { nextInterestDeposit } from '../src/index.js';

const SPEND_SCALAR = new Uint8Array(32).fill(1);
const BLEND_POOL = new Uint8Array(32).fill(2);
const TOKEN = new Uint8Array(32).fill(3);
const CHAIN_INDEX_0_ACCOUNT =
  'GBRS2YFQI36FCWICQNEJPB7D6EJWQL62ME7GHBNSFK2TIQWQPE6A6IUT';
const CHAIN_INDEX_1_ACCOUNT =
  'GB2MQYCMOF5GP3Q53Q4JCJHJLKDUH6BD5QN6AZEN2WSOW67GMZXI3RQ6';
const FIRST_SHARE_BALANCE = 42n;

describe('a second Interest Deposit', () => {
  it('takes the next free chain index and leaves the first share balance unchanged', async () => {
    const shares = new Map<string, bigint>([
      [CHAIN_INDEX_0_ACCOUNT, FIRST_SHARE_BALANCE],
    ]);

    const next = await nextInterestDeposit({
      spendScalar: SPEND_SCALAR,
      blendPoolContractId: BLEND_POOL,
      tokenContractId: TOKEN,
      sharesOf: (account) => Promise.resolve(shares.get(account) ?? 0n),
    });

    expect(next).toEqual({
      chainIndex: 1,
      account: CHAIN_INDEX_1_ACCOUNT,
    });
    expect(shares.get(CHAIN_INDEX_0_ACCOUNT)).toBe(FIRST_SHARE_BALANCE);
  });
});
