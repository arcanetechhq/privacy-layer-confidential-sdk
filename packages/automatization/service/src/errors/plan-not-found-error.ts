export class PlanNotFoundError extends Error {
  constructor() {
    super('Plan was not found');
    this.name = 'PlanNotFoundError';
  }
}
