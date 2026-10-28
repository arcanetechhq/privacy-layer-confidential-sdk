import type { Step } from '@arcanetech/privacy-sdk-automatization-plan';

export class UnderfundedPlanError extends Error {
  readonly steps: readonly Step[];

  constructor(steps: readonly Step[]) {
    super('Underfunded Step');
    this.name = 'UnderfundedPlanError';
    this.steps = steps;
  }
}
