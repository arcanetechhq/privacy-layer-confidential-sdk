import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['packages/**/test/**/*.test.ts', 'scripts/**/*.test.ts'],
    typecheck: {
      enabled: true,
      include: ['packages/**/test/**/*.type-test.ts'],
    },
  },
});
