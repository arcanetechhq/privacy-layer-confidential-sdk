export class FreeTokensBelowFloorError extends Error {
  constructor() {
    super('Free tokens cannot be set below the Free-token floor');
    this.name = 'FreeTokensBelowFloorError';
  }
}
