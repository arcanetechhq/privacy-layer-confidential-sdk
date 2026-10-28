import type { Plan } from '@arcanetech/privacy-sdk-automatization-plan';
import { PlanNotFoundError } from '../../errors/index.js';
import type {
  DepositAuthorization,
  DepositMaterial,
  FeeQuote,
  InitialQuotes,
  PlanCancellation,
  PlanDocuments,
  PlanRegistry,
  PreparedDeposit,
  StepTimes,
  StoredUnspentNote,
  UnspentNoteStore,
} from '../../ports/index.js';
import {
  copyAuthorization,
  copyPreparedDeposit,
  copyUnspentNote,
  samePlace,
} from './copies.js';

export interface Clearable {
  clear(): Promise<void>;
}

function found<T>(value: T | undefined): T {
  if (value === undefined) {
    throw new PlanNotFoundError();
  }
  return value;
}

export function createMemoryPlanRegistry(): PlanRegistry & Clearable {
  let allocated: string[] = [];
  return {
    async allocateId() {
      const id = `plan-${String(allocated.length + 1)}`;
      allocated = [...allocated, id];
      return id;
    },
    async ids() {
      return [...allocated];
    },
    async clear() {
      allocated = [];
    },
  };
}

export function createMemoryPlanDocuments(): PlanDocuments & Clearable {
  const plans = new Map<string, Plan>();
  return {
    async savePlan(id, plan) {
      plans.set(id, plan);
    },
    async read(id) {
      return found(plans.get(id));
    },
    async clear() {
      plans.clear();
    },
  };
}

export function createMemoryStepTimes(): StepTimes & Clearable {
  const confirmed = new Map<string, bigint>();
  const executed = new Map<string, Map<string, bigint>>();
  return {
    async start(id, confirmedAt) {
      confirmed.set(id, confirmedAt);
      executed.set(id, new Map());
    },
    async confirmedAt(id) {
      return found(confirmed.get(id));
    },
    async executedAt(id, stepKey) {
      return found(executed.get(id)).get(stepKey);
    },
    async rememberExecutedAt(id, stepKey, at) {
      const times = found(executed.get(id));
      if (!times.has(stepKey)) {
        times.set(stepKey, at);
      }
    },
    async clear() {
      confirmed.clear();
      executed.clear();
    },
  };
}

export function createMemoryInitialQuotes(): InitialQuotes & Clearable {
  const quotes = new Map<string, FeeQuote>();
  return {
    async acceptedInitialQuote(id) {
      return quotes.get(id);
    },
    async recordAcceptedInitialQuote(id, quote) {
      if (!quotes.has(id)) {
        quotes.set(id, { amount: quote.amount, collector: quote.collector });
      }
    },
    async clear() {
      quotes.clear();
    },
  };
}

export function createMemoryPlanCancellation(): PlanCancellation & Clearable {
  const cancelled = new Set<string>();
  return {
    async isCancelled(id) {
      return cancelled.has(id);
    },
    async cancel(id) {
      cancelled.add(id);
    },
    async clear() {
      cancelled.clear();
    },
  };
}

export function createMemoryDepositMaterial(): DepositMaterial & Clearable {
  const authorizations = new Map<string, DepositAuthorization[]>();
  const prepared = new Map<string, PreparedDeposit[]>();
  return {
    async addDepositAuthorization(id, authorization) {
      authorizations.set(id, [
        ...(authorizations.get(id) ?? []),
        copyAuthorization(authorization),
      ]);
    },
    async depositAuthorizations(id) {
      return (authorizations.get(id) ?? []).map((entry) => copyAuthorization(entry));
    },
    async savePreparedDeposit(id, next) {
      const kept = (prepared.get(id) ?? []).filter(
        (existing) => !samePlace(existing.step, next.step),
      );
      prepared.set(id, [...kept, copyPreparedDeposit(next)]);
    },
    async preparedDeposit(id, step) {
      const match = (prepared.get(id) ?? []).find((entry) =>
        samePlace(entry.step, step),
      );
      return match === undefined ? undefined : copyPreparedDeposit(match);
    },
    async discard(id) {
      authorizations.delete(id);
      prepared.delete(id);
    },
    async clear() {
      authorizations.clear();
      prepared.clear();
    },
  };
}

export function createMemoryUnspentNotes(): UnspentNoteStore & Clearable {
  const notes = new Map<string, StoredUnspentNote[]>();
  return {
    async addUnspentNote(id, note) {
      notes.set(id, [...(notes.get(id) ?? []), copyUnspentNote(note)]);
    },
    async unspentNotes(id) {
      return (notes.get(id) ?? []).map((note) => copyUnspentNote(note));
    },
    async clear() {
      notes.clear();
    },
  };
}
