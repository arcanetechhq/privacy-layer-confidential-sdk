import { describe, expect, it } from 'vitest';
import { measureStage, TX_BENCH_PREFIX } from '../src/measure-stage.js';

describe('measureStage', () => {
  it('records a parent measure that contains its child', async () => {
    performance.clearMarks();
    performance.clearMeasures();
    await measureStage('prepare', async () => {
      await measureStage('prove', async () => {
        await measureStage('groth16', () => 'proof');
      });
    });
    const names = performance.getEntriesByType('measure').map((entry) => entry.name);
    expect(names).toHaveLength(3);
    expect(names).toContain(`${TX_BENCH_PREFIX}groth16`);
    expect(names).toContain(`${TX_BENCH_PREFIX}prepare`);
    expect(names).toContain(`${TX_BENCH_PREFIX}prove`);
    const prepare = performance.getEntriesByName(`${TX_BENCH_PREFIX}prepare`)[0];
    const prove = performance.getEntriesByName(`${TX_BENCH_PREFIX}prove`)[0];
    const groth16 = performance.getEntriesByName(`${TX_BENCH_PREFIX}groth16`)[0];
    expect(prepare).toBeDefined();
    expect(prove).toBeDefined();
    expect(groth16).toBeDefined();
    if (!prepare || !prove || !groth16) {
      return;
    }
    expect(prove.startTime).toBeGreaterThanOrEqual(prepare.startTime);
    expect(prove.startTime + prove.duration).toBeLessThanOrEqual(
      prepare.startTime + prepare.duration + 1,
    );
    expect(groth16.startTime).toBeGreaterThanOrEqual(prove.startTime);
  });

  it('records the stage when the work throws', async () => {
    performance.clearMarks();
    performance.clearMeasures();
    await expect(
      measureStage('sign', () => {
        throw new Error('rejected');
      }),
    ).rejects.toThrow('rejected');
    expect(performance.getEntriesByName(`${TX_BENCH_PREFIX}sign`)).toHaveLength(1);
  });
});
