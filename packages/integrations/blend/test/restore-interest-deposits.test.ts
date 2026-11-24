import { describe, expect, it } from 'vitest';
import {
  deriveInterestDepositSeed,
  interestDepositAccount,
  restoreInterestDeposits,
  type InterestDepositMarket,
} from '../src/index.js';

const SPEND_SCALAR = new Uint8Array(32).fill(1);
const OTHER_SCALAR = new Uint8Array(32).fill(5);
const BLEND_POOL = new Uint8Array(32).fill(2);
const OTHER_POOL = new Uint8Array(32).fill(6);
const TOKEN = new Uint8Array(32).fill(3);
const OTHER_TOKEN = new Uint8Array(32).fill(7);
const EXCHANGE_RATE = 2_000_000_000_000n;
const CHAIN_INDEX_0_ACCOUNT =
  'GBRS2YFQI36FCWICQNEJPB7D6EJWQL62ME7GHBNSFK2TIQWQPE6A6IUT';
const CHAIN_INDEX_1_ACCOUNT =
  'GB2MQYCMOF5GP3Q53Q4JCJHJLKDUH6BD5QN6AZEN2WSOW67GMZXI3RQ6';
const PRIMARY_SHARES = 42n;
const ZERO_SHARES = 0n;
const LATER_SHARES = 8n;
const GAP_SHARES = 7n;
const OTHER_POOL_SHARES = 5n;
const OTHER_TOKEN_SHARES = 9n;
const SECOND_SCALAR_SHARES = 3n;
const PRIMARY_UNDERLYING = 84n;
const LATER_UNDERLYING = 16n;
const OTHER_POOL_UNDERLYING = 10n;
const OTHER_TOKEN_UNDERLYING = 18n;
const SECOND_SCALAR_UNDERLYING = 6n;
const GAP_INDEX = 4;
const LAST_RECORDED_INDEX = 2;

describe('a restored wallet', () => {
  it('finds every Interest Deposit, including a zero record, and stops at the first missing index', async () => {
    const primaryZero = await chainAccount(SPEND_SCALAR, BLEND_POOL, TOKEN, 0);
    const primaryOne = await chainAccount(SPEND_SCALAR, BLEND_POOL, TOKEN, 1);
    const primaryLater = await chainAccount(
      SPEND_SCALAR,
      BLEND_POOL,
      TOKEN,
      LAST_RECORDED_INDEX,
    );
    const primaryGap = await chainAccount(SPEND_SCALAR, BLEND_POOL, TOKEN, GAP_INDEX);
    const otherPool = await chainAccount(SPEND_SCALAR, OTHER_POOL, TOKEN, 0);
    const otherToken = await chainAccount(SPEND_SCALAR, BLEND_POOL, OTHER_TOKEN, 0);
    const secondScalar = await chainAccount(OTHER_SCALAR, BLEND_POOL, TOKEN, 0);
    const shares = new Map<string, bigint>([
      [primaryZero, PRIMARY_SHARES],
      [primaryOne, ZERO_SHARES],
      [primaryLater, LATER_SHARES],
      [primaryGap, GAP_SHARES],
      [otherPool, OTHER_POOL_SHARES],
      [otherToken, OTHER_TOKEN_SHARES],
      [secondScalar, SECOND_SCALAR_SHARES],
    ]);

    const restored = await restoreInterestDeposits({
      spendScalars: [SPEND_SCALAR, OTHER_SCALAR],
      markets: [
        market(BLEND_POOL, TOKEN),
        market(OTHER_POOL, TOKEN),
        market(BLEND_POOL, OTHER_TOKEN),
      ],
      recorded: (query) => Promise.resolve(shares.has(query.account)),
      shares: (query) => Promise.resolve(shares.get(query.account) ?? ZERO_SHARES),
    });

    expect(primaryZero).toBe(CHAIN_INDEX_0_ACCOUNT);
    expect(primaryOne).toBe(CHAIN_INDEX_1_ACCOUNT);
    expect(restored).toEqual([
      {
        chainIndex: 0,
        account: primaryZero,
        shares: PRIMARY_SHARES,
        underlying: PRIMARY_UNDERLYING,
        blendPoolContractId: BLEND_POOL,
        tokenContractId: TOKEN,
      },
      {
        chainIndex: 1,
        account: primaryOne,
        shares: ZERO_SHARES,
        underlying: ZERO_SHARES,
        blendPoolContractId: BLEND_POOL,
        tokenContractId: TOKEN,
      },
      {
        chainIndex: LAST_RECORDED_INDEX,
        account: primaryLater,
        shares: LATER_SHARES,
        underlying: LATER_UNDERLYING,
        blendPoolContractId: BLEND_POOL,
        tokenContractId: TOKEN,
      },
      {
        chainIndex: 0,
        account: otherPool,
        shares: OTHER_POOL_SHARES,
        underlying: OTHER_POOL_UNDERLYING,
        blendPoolContractId: OTHER_POOL,
        tokenContractId: TOKEN,
      },
      {
        chainIndex: 0,
        account: otherToken,
        shares: OTHER_TOKEN_SHARES,
        underlying: OTHER_TOKEN_UNDERLYING,
        blendPoolContractId: BLEND_POOL,
        tokenContractId: OTHER_TOKEN,
      },
      {
        chainIndex: 0,
        account: secondScalar,
        shares: SECOND_SCALAR_SHARES,
        underlying: SECOND_SCALAR_UNDERLYING,
        blendPoolContractId: BLEND_POOL,
        tokenContractId: TOKEN,
      },
    ]);
    expect(restored.some((item) => item.account === primaryGap)).toBe(false);
  });
});

function market(
  blendPoolContractId: Uint8Array,
  tokenContractId: Uint8Array,
): InterestDepositMarket {
  return { blendPoolContractId, tokenContractId, exchangeRate: EXCHANGE_RATE };
}

async function chainAccount(
  spendScalar: Uint8Array,
  blendPoolContractId: Uint8Array,
  tokenContractId: Uint8Array,
  chainIndex: number,
): Promise<string> {
  return interestDepositAccount(
    await deriveInterestDepositSeed({
      spendScalar,
      blendPoolContractId,
      tokenContractId,
      chainIndex,
    }),
  );
}
