import { describe, expect, it } from 'vitest';

declare global {
  interface ImportMeta {
    glob(
      pattern: string,
      options: { eager: true; import: 'default'; query: '?raw' },
    ): Record<string, string>;
  }
}

const FORBIDDEN_LITERALS = [
  'stellar.escrow-tag',
  'stellar.output-note',
  'stellar.escrow-index',
];

const coreSources = import.meta.glob('../../core/src/**/*.ts', {
  eager: true,
  import: 'default',
  query: '?raw',
});

const dataLayerSources = import.meta.glob('../src/**/*.ts', {
  eager: true,
  import: 'default',
  query: '?raw',
});

function sourceText(modules: Record<string, string>): string {
  return Object.values(modules).join('\n');
}

describe('private-data package boundaries', () => {
  it('keeps Stellar protocol and data-type literals out of the shared packages', () => {
    const sharedSource = `${sourceText(coreSources)}\n${sourceText(dataLayerSources)}`;
    for (const literal of FORBIDDEN_LITERALS) {
      expect(sharedSource).not.toContain(literal);
    }
  });
});
