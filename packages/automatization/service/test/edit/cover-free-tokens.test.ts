import { expect, it } from 'vitest';
import {
  compose,
  coverFreeTokens,
  locateSteps,
  quoteRequest,
  type FeeQuote,
  type FeeQuoteRequest,
} from '../../src/index.js';
import {
  depositAt,
  notes,
  payoutAt,
  recipients,
} from '../support/compose-plan.support.test.js';

const limits = { freeTokenFloor: 2n, notes };

function percentFee(request: FeeQuoteRequest): FeeQuote {
  const base =
    request.publicDeposit + request.publicWithdrawal + privateTransfer(request);
  return { amount: ceilPercent(base), collector: 'fee-collector' };
}

const percentQuotes = {
  quote: (request: FeeQuoteRequest) => Promise.resolve(percentFee(request)),
};

function privateTransfer(request: FeeQuoteRequest): bigint {
  const publicAmount = request.publicDeposit + request.publicWithdrawal;
  if (request.valueMoved > publicAmount) {
    return request.valueMoved - publicAmount;
  }
  return 0n;
}

function ceilPercent(base: bigint): bigint {
  if (base <= 0n) {
    return 0n;
  }
  const quotient = base / 100n;
  const remainder = base % 100n;
  const rounded = remainder === 0n ? quotient : quotient + 1n;
  return rounded < 1n ? 1n : rounded;
}

it('leaves a Plan unchanged when every Step already covers its Fee quote', async () => {
  const plan = compose({ recipients, freeTokenFloor: 2n, standardInterval: 7n }, notes);

  expect(await coverFreeTokens(plan, percentQuotes, limits)).toBe(plan);
});

it('raises Free tokens to a one percent Fee quote and funds the increase from the covering Deposit', async () => {
  const plan = compose(
    {
      recipients: [
        { account: 'bob-account', amount: 100n },
        { account: 'carol-account', amount: 100n },
        { account: 'dave-account', amount: 100n },
        { account: 'erin-account', amount: 100n },
      ],
      freeTokenFloor: 2n,
      standardInterval: 7n,
    },
    notes,
  );

  const covered = await coverFreeTokens(plan, percentQuotes, limits);

  expect(depositAt(covered, 0).amount).toBe(416n);
  expect(depositAt(covered, 0).step.freeTokens).toBe(5n);
  expect(payoutAt(covered, 3).transfer?.freeTokens).toBe(3n);
  expect(payoutAt(covered, 1).withdrawal.freeTokens).toBe(2n);
  for (const step of locateSteps(covered)) {
    const quote = percentFee(
      quoteRequest(step.step, step.publicDeposit, step.publicWithdrawal),
    );
    expect(quote.amount <= step.step.freeTokens).toBe(true);
  }
  expect(await coverFreeTokens(covered, percentQuotes, limits)).toBe(covered);
});
