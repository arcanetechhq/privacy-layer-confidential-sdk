import type { Plan } from '@arcanetech/privacy-sdk-automatization-plan';
import { locateSteps, quoteRequest } from '../../domain/steps/index.js';
import type { FeeQuotes, NoteDeriver } from '../../ports/index.js';
import { reviseFreeTokens } from './revise-free-tokens.js';

const PASSES = 8;

export async function coverFreeTokens(
  plan: Plan,
  quotes: FeeQuotes,
  limits: { readonly freeTokenFloor: bigint; readonly notes: NoteDeriver },
): Promise<Plan> {
  let current = plan;
  for (let pass = 0; pass < PASSES; pass += 1) {
    const located = locateSteps(current);
    let next = current;
    let raised = false;
    for (const step of located) {
      const quote = await quotes.quote(
        quoteRequest(step.step, step.publicDeposit, step.publicWithdrawal),
      );
      if (quote.amount > step.step.freeTokens) {
        next = reviseFreeTokens(next, step.place, quote.amount, limits);
        raised = true;
      }
    }
    if (!raised) {
      return current;
    }
    current = next;
  }
  throw new Error('Fee quote did not fit the Plan');
}
