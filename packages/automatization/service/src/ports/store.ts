import type { Plan } from '@arcanetech/privacy-sdk-automatization-plan';
import type { PreparedDeposit, StoredUnspentNote } from './notes.js';
import type { StepPlace } from './plan.js';
import type { FeeQuote } from './quotes.js';
import type { DepositAuthorization } from './transact.js';

export interface PlanRegistry {
  allocateId(): Promise<string>;
  ids(): Promise<readonly string[]>;
}

export interface PlanDocuments {
  savePlan(id: string, plan: Plan): Promise<void>;
  read(id: string): Promise<Plan>;
}

export interface StepTimes {
  start(id: string, confirmedAt: bigint): Promise<void>;
  confirmedAt(id: string): Promise<bigint>;
  executedAt(id: string, stepKey: string): Promise<bigint | undefined>;
  rememberExecutedAt(id: string, stepKey: string, at: bigint): Promise<void>;
}

export interface InitialQuotes {
  acceptedInitialQuote(id: string): Promise<FeeQuote | undefined>;
  recordAcceptedInitialQuote(id: string, quote: FeeQuote): Promise<void>;
}

export interface PlanCancellation {
  isCancelled(id: string): Promise<boolean>;
  cancel(id: string): Promise<void>;
}

export interface DepositMaterial {
  addDepositAuthorization(
    id: string,
    authorization: DepositAuthorization,
  ): Promise<void>;
  depositAuthorizations(id: string): Promise<readonly DepositAuthorization[]>;
  savePreparedDeposit(id: string, prepared: PreparedDeposit): Promise<void>;
  preparedDeposit(id: string, step: StepPlace): Promise<PreparedDeposit | undefined>;
  discard(id: string): Promise<void>;
}

export interface UnspentNoteStore {
  addUnspentNote(id: string, note: StoredUnspentNote): Promise<void>;
  unspentNotes(id: string): Promise<readonly StoredUnspentNote[]>;
}

export interface PlanStore
  extends
    PlanRegistry,
    PlanDocuments,
    StepTimes,
    InitialQuotes,
    PlanCancellation,
    DepositMaterial,
    UnspentNoteStore {}

export type ExecutionTimes = Pick<
  StepTimes,
  'confirmedAt' | 'executedAt' | 'rememberExecutedAt'
>;

export interface QuoteGuardStore
  extends
    Pick<InitialQuotes, 'acceptedInitialQuote' | 'recordAcceptedInitialQuote'>,
    Pick<PlanCancellation, 'cancel'> {}

export interface ConfirmStore
  extends
    Pick<PlanRegistry, 'allocateId'>,
    Pick<PlanDocuments, 'savePlan'>,
    Pick<StepTimes, 'start'>,
    Pick<InitialQuotes, 'recordAcceptedInitialQuote'>,
    Pick<DepositMaterial, 'addDepositAuthorization'>,
    Pick<UnspentNoteStore, 'addUnspentNote'> {}

export interface AuthorizeDepositStore
  extends
    Pick<PlanDocuments, 'read'>,
    Pick<PlanCancellation, 'isCancelled'>,
    ExecutionTimes,
    QuoteGuardStore,
    Pick<DepositMaterial, 'addDepositAuthorization' | 'savePreparedDeposit'> {}

export interface StepRunStore
  extends
    Pick<PlanRegistry, 'ids'>,
    PlanDocuments,
    Pick<PlanCancellation, 'isCancelled'>,
    ExecutionTimes,
    QuoteGuardStore,
    Pick<DepositMaterial, 'preparedDeposit' | 'depositAuthorizations'>,
    Pick<UnspentNoteStore, 'addUnspentNote'> {}

export interface PlanReadStore
  extends
    Pick<PlanDocuments, 'read'>,
    Pick<PlanCancellation, 'isCancelled'>,
    Pick<UnspentNoteStore, 'unspentNotes'> {}
