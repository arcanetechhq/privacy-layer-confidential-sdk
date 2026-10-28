import type { Plan } from '@arcanetech/privacy-sdk-automatization-plan';
import type { PlanReadStore } from '../../ports/index.js';

export function read(id: string, store: Pick<PlanReadStore, 'read'>): Promise<Plan> {
  return store.read(id);
}
