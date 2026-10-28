import type { Row, Step } from '../document/index.js';

export function stepsInRow(row: Row): readonly Step[] {
  if (row.kind === 'deposit') {
    return [row.step];
  }
  return row.transfer === undefined ? [row.withdrawal] : [row.transfer, row.withdrawal];
}
