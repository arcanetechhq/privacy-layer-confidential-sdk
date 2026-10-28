import type { Clock } from '../ports/index.js';

export const systemClock: Clock = {
  now: () => Promise.resolve(BigInt(Date.now())),
};
