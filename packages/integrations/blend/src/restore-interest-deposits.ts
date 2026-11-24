import { deriveInterestDepositSeed } from './derive-interest-deposit-seed.js';
import { interestDepositAccount } from './interest-deposit-account.js';
import { underlyingFromShares } from './underlying.js';

export interface InterestDepositMarket {
  blendPoolContractId: Uint8Array;
  tokenContractId: Uint8Array;
  exchangeRate: bigint;
}

export interface InterestDepositBalanceQuery {
  account: string;
  blendPoolContractId: Uint8Array;
  tokenContractId: Uint8Array;
}

export interface RestoreInterestDepositsInput {
  spendScalars: readonly Uint8Array[];
  markets: readonly InterestDepositMarket[];
  recorded: (query: InterestDepositBalanceQuery) => Promise<boolean>;
  shares: (query: InterestDepositBalanceQuery) => Promise<bigint>;
}

export interface RestoredInterestDeposit {
  chainIndex: number;
  account: string;
  blendPoolContractId: Uint8Array;
  tokenContractId: Uint8Array;
  shares: bigint;
  underlying: bigint;
}

interface ChainScan {
  input: RestoreInterestDepositsInput;
  scalarIndex: number;
  marketIndex: number;
  chainIndex: number;
  found: RestoredInterestDeposit[];
}

export async function restoreInterestDeposits(
  input: RestoreInterestDepositsInput,
): Promise<RestoredInterestDeposit[]> {
  return walk({
    input,
    scalarIndex: 0,
    marketIndex: 0,
    chainIndex: 0,
    found: [],
  });
}

async function walk(scan: ChainScan): Promise<RestoredInterestDeposit[]> {
  const spendScalar = scan.input.spendScalars.at(scan.scalarIndex);
  if (!spendScalar) {
    return scan.found;
  }
  const market = scan.input.markets.at(scan.marketIndex);
  if (!market) {
    return walk(nextScalar(scan));
  }
  const deposit = await readRecordedDeposit({
    recorded: scan.input.recorded,
    shares: scan.input.shares,
    spendScalar,
    market,
    chainIndex: scan.chainIndex,
  });
  if (!deposit) {
    return walk(nextMarket(scan));
  }
  return walk({
    ...scan,
    chainIndex: scan.chainIndex + 1,
    found: [...scan.found, deposit],
  });
}

function nextScalar(scan: ChainScan): ChainScan {
  return {
    ...scan,
    scalarIndex: scan.scalarIndex + 1,
    marketIndex: 0,
    chainIndex: 0,
  };
}

function nextMarket(scan: ChainScan): ChainScan {
  return { ...scan, marketIndex: scan.marketIndex + 1, chainIndex: 0 };
}

async function readRecordedDeposit(input: {
  recorded: RestoreInterestDepositsInput['recorded'];
  shares: RestoreInterestDepositsInput['shares'];
  spendScalar: Uint8Array;
  market: InterestDepositMarket;
  chainIndex: number;
}): Promise<RestoredInterestDeposit | undefined> {
  const query = await balanceQuery(input);
  if (!(await input.recorded(query))) {
    return undefined;
  }
  const shares = await input.shares(query);
  return {
    chainIndex: input.chainIndex,
    account: query.account,
    blendPoolContractId: input.market.blendPoolContractId,
    tokenContractId: input.market.tokenContractId,
    shares,
    underlying: underlyingFromShares(shares, input.market.exchangeRate),
  };
}

async function balanceQuery(input: {
  spendScalar: Uint8Array;
  market: InterestDepositMarket;
  chainIndex: number;
}): Promise<InterestDepositBalanceQuery> {
  const seed = await deriveInterestDepositSeed({
    spendScalar: input.spendScalar,
    blendPoolContractId: input.market.blendPoolContractId,
    tokenContractId: input.market.tokenContractId,
    chainIndex: input.chainIndex,
  });
  return {
    account: interestDepositAccount(seed),
    blendPoolContractId: input.market.blendPoolContractId,
    tokenContractId: input.market.tokenContractId,
  };
}
