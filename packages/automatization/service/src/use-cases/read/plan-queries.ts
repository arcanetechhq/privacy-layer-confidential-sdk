import type { PlanReadStore, StoredUnspentNote } from '../../ports/index.js';

export function unspentNotes(
  planId: string,
  store: Pick<PlanReadStore, 'unspentNotes'>,
): Promise<readonly StoredUnspentNote[]> {
  return store.unspentNotes(planId);
}

export function isCancelledPlan(
  id: string,
  store: Pick<PlanReadStore, 'isCancelled'>,
): Promise<boolean> {
  return store.isCancelled(id);
}
