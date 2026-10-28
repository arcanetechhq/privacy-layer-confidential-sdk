import type { Step } from '@arcanetech/privacy-sdk-automatization-plan';
import type { FeeQuoteRequest } from '../../ports/index.js';

function valueMoved(step: Step): bigint {
  let total = step.freeTokens;
  for (const output of step.pinnedOutputs) {
    total += output.plaintext.amount;
  }
  return total;
}

export function quoteRequest(
  step: Step,
  publicDeposit: bigint,
  publicWithdrawal: bigint,
): FeeQuoteRequest {
  return {
    publicDeposit,
    valueMoved: valueMoved(step),
    publicWithdrawal,
  };
}
