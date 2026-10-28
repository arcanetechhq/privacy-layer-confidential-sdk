import type { StepDependencies } from './dependencies.js';
import { submitCandidate } from './submit-step.js';

export async function runDueSteps(dependencies: StepDependencies): Promise<void> {
  for (const id of await dependencies.store.ids()) {
    await submitCandidate(id, dependencies, false);
  }
}

export async function submitNextStep(
  planId: string,
  dependencies: StepDependencies,
): Promise<void> {
  await submitCandidate(planId, dependencies, true);
}
