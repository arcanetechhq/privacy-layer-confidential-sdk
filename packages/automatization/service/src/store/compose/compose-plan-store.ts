import type {
  DepositMaterial,
  InitialQuotes,
  PlanCancellation,
  PlanDocuments,
  PlanRegistry,
  PlanStore,
  StepTimes,
  UnspentNoteStore,
} from '../../ports/index.js';

export interface PlanStoreParts {
  readonly registry: PlanRegistry;
  readonly documents: PlanDocuments;
  readonly times: StepTimes;
  readonly quotes: InitialQuotes;
  readonly cancellation: PlanCancellation;
  readonly deposits: DepositMaterial;
  readonly unspentNotes: UnspentNoteStore;
}

export function composePlanStore(parts: PlanStoreParts): PlanStore {
  const { registry, documents, times, quotes, cancellation, deposits, unspentNotes } =
    parts;
  return {
    allocateId: () => registry.allocateId(),
    ids: () => registry.ids(),
    savePlan: (id, plan) => documents.savePlan(id, plan),
    read: (id) => documents.read(id),
    start: (id, confirmedAt) => times.start(id, confirmedAt),
    confirmedAt: (id) => times.confirmedAt(id),
    executedAt: (id, stepKey) => times.executedAt(id, stepKey),
    rememberExecutedAt: (id, stepKey, at) => times.rememberExecutedAt(id, stepKey, at),
    acceptedInitialQuote: (id) => quotes.acceptedInitialQuote(id),
    recordAcceptedInitialQuote: (id, quote) =>
      quotes.recordAcceptedInitialQuote(id, quote),
    isCancelled: (id) => cancellation.isCancelled(id),
    async cancel(id) {
      await cancellation.cancel(id);
      await deposits.discard(id);
    },
    addDepositAuthorization: (id, authorization) =>
      deposits.addDepositAuthorization(id, authorization),
    depositAuthorizations: (id) => deposits.depositAuthorizations(id),
    savePreparedDeposit: (id, prepared) => deposits.savePreparedDeposit(id, prepared),
    preparedDeposit: (id, step) => deposits.preparedDeposit(id, step),
    discard: (id) => deposits.discard(id),
    addUnspentNote: (id, note) => unspentNotes.addUnspentNote(id, note),
    unspentNotes: (id) => unspentNotes.unspentNotes(id),
  };
}
