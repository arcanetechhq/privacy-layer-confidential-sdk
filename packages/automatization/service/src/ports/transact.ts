import type {
  DepositInvocation,
  Step,
} from '@arcanetech/privacy-sdk-automatization-plan';
import type { UnspentNoteShape } from './notes.js';
import type { FeeNote, FeeQuote } from './quotes.js';

export type TransactInvocation = DepositInvocation;

export interface DepositAuthorization {
  readonly invocation: TransactInvocation;
  readonly sorobanAuthorization: string;
}

export interface ProofRequest {
  readonly step: Step;
  readonly quote: FeeQuote;
  readonly root: string;
  readonly feeNote: FeeNote;
  readonly unspentNote?: UnspentNoteShape;
  readonly publicDeposit: bigint;
  readonly publicWithdrawal: bigint;
  readonly recipient: string;
}

export interface Proofs {
  prove(input: ProofRequest): Promise<TransactInvocation>;
}

export type InspectDecision = 'accept' | 'refuse';

export interface Inspection {
  inspect(invocation: TransactInvocation): Promise<InspectDecision>;
}

export interface DepositSigning {
  authEntries(invocation: TransactInvocation): Promise<readonly string[]>;
}
