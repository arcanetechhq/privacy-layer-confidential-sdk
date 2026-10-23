import type { Row, Step } from './document.js';

export function stepsInRow(row: Row): readonly Step[] {
  if (row.kind === 'deposit') {
    return [row.step];
  }
  return [row.transfer, row.withdrawal];
}
