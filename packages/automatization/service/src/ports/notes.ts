import type { StepPlace } from './plan.js';
import type { FeeQuote } from './quotes.js';
import type { TransactInvocation } from './transact.js';

export interface UnspentNoteShape {
  readonly amount: bigint;
  readonly accumulator: string;
  readonly scalar: string;
}

export interface StoredUnspentNote extends UnspentNoteShape {
  readonly planId: string;
  readonly step: StepPlace;
}

export interface PreparedDeposit {
  readonly step: StepPlace;
  readonly quote: FeeQuote;
  readonly invocation: TransactInvocation;
  readonly unspentNote?: UnspentNoteShape;
}

export interface PlanConfirmation {
  readonly confirmedAt: bigint;
  readonly acceptedInitialQuote?: FeeQuote;
}
