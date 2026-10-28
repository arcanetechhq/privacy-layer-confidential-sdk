import type { Step } from '@arcanetech/privacy-sdk-automatization-plan';
import type {
  FeeNote,
  FeeQuote,
  FreshScalars,
  UnspentNoteShape,
} from '../../ports/index.js';

const ZERO_ACCUMULATOR = '';

export async function maskedOutputs(
  step: Step,
  quote: FeeQuote,
  freshScalars: FreshScalars,
): Promise<{ readonly feeNote: FeeNote; readonly unspentNote?: UnspentNoteShape }> {
  const feeNote: FeeNote = {
    amount: quote.amount,
    accumulator: ZERO_ACCUMULATOR,
    collector: quote.collector,
  };
  const leftover = step.freeTokens - quote.amount;
  if (leftover <= 0n) {
    return { feeNote };
  }
  return {
    feeNote,
    unspentNote: {
      amount: leftover,
      accumulator: ZERO_ACCUMULATOR,
      scalar: await freshScalars.next(),
    },
  };
}
