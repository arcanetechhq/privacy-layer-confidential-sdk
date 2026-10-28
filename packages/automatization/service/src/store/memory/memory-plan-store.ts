import { composePlanStore } from '../compose/index.js';
import type { PlanStore } from '../../ports/index.js';
import {
  createMemoryDepositMaterial,
  createMemoryInitialQuotes,
  createMemoryPlanCancellation,
  createMemoryPlanDocuments,
  createMemoryPlanRegistry,
  createMemoryStepTimes,
  createMemoryUnspentNotes,
  type Clearable,
} from './parts.js';

export type MemoryPlanStore = PlanStore & Clearable;

export function createMemoryPlanStore(): MemoryPlanStore {
  const parts = {
    registry: createMemoryPlanRegistry(),
    documents: createMemoryPlanDocuments(),
    times: createMemoryStepTimes(),
    quotes: createMemoryInitialQuotes(),
    cancellation: createMemoryPlanCancellation(),
    deposits: createMemoryDepositMaterial(),
    unspentNotes: createMemoryUnspentNotes(),
  };
  return {
    ...composePlanStore(parts),
    async clear() {
      await Promise.all(Object.values(parts).map((part) => part.clear()));
    },
  };
}
