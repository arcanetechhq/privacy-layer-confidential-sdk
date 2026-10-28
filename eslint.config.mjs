import js from '@eslint/js';
import betterMaxParams from 'eslint-plugin-better-max-params';
import { configs as sonarjsConfigs } from 'eslint-plugin-sonarjs';
import unicorn from 'eslint-plugin-unicorn';
import security from 'eslint-plugin-security';
import tseslint from 'typescript-eslint';
import { defineConfig } from 'eslint/config';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';

const moduleBoundaryPattern = {
  regex: String.raw`^\.(?!/[^/]+$)(?!.*/[^./][^/]*/index\.js$)`,
  message:
    'Import a sibling file as ./file.js or another module through its public <module>/index.js; do not import upward or into module internals.',
};

const automatizationImportBoundaries = (...patterns) => ({
  'no-restricted-imports': ['error', { patterns: [moduleBoundaryPattern, ...patterns] }],
});

export default defineConfig([
  sonarjsConfigs.recommended,
  unicorn.configs['recommended'],
  {
    ignores: [
      'dist/**',
      '**/dist/**',
      'node_modules/**',
      'coverage/**',
      '.cursor/**',
      '.scratch/**',
      'docs/**',
      'eslint.config.mjs',
      '**/*.config.ts',
      '**/generated/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  security.configs.recommended,
  {
    plugins: {
      'better-max-params': betterMaxParams,
    },
    rules: {
      'better-max-params/better-max-params': [
        'error',
        {
          constructor: 10,
          func: 4,
        },
      ],
      'max-lines-per-function': ['error', { max: 50, skipBlankLines: true }],
      'max-lines': ['error', { max: 250, skipBlankLines: true }],
      complexity: ['error', 12],
      'max-depth': ['error', 4],
      'max-statements': ['error', 25],
      'max-classes-per-file': ['error', 1],
      'no-console': 'error',
      eqeqeq: ['error', 'always'],
      'sonarjs/redundant-type-aliases': 'off',
      'sonarjs/use-type-alias': 'off',
      'unicorn/prevent-abbreviations': [
        'error',
        {
          extendDefaultReplacements: true,
          replacements: {
            args: false,
            env: false,
            fn: false,
            params: false,
            props: false,
            ref: false,
          },
        },
      ],
    },
  },
  {
    files: ['**/*.test.ts', '**/*.type-test.ts'],
    rules: {
      'max-lines-per-function': ['error', { max: 200, skipBlankLines: true }],
      'max-lines': ['error', { max: 500, skipBlankLines: true }],
      'max-statements': ['off'],
      'unicorn/no-useless-undefined': 'off',
    },
  },
  {
    files: ['packages/**/src/**/*.ts', 'packages/**/test/**/*.ts'],
    rules: {
      'unicorn/prefer-node-protocol': 'off',
    },
  },
  {
    files: ['packages/automatization/*/src/**/*.ts'],
    rules: automatizationImportBoundaries(),
  },
  {
    files: ['packages/automatization/service/src/use-cases/**/*.ts'],
    rules: automatizationImportBoundaries({
      regex: String.raw`^\.\./[^./]`,
      message: 'A use case must not import another use case; move shared logic into domain/.',
    }),
  },
  {
    files: [
      'packages/automatization/service/src/{defaults,stellar,store,testing}/**/*.ts',
    ],
    rules: automatizationImportBoundaries({
      regex: String.raw`/(use-cases|domain)/`,
      message: 'Adapters implement ports; they must not import use cases or domain logic.',
    }),
  },
  {
    files: ['packages/stellar/src/assets/load-node.ts'],
    rules: {
      'security/detect-non-literal-fs-filename': 'off',
    },
  },
  eslintPluginPrettierRecommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
      },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'prettier/prettier': ['error', { endOfLine: 'auto' }],
    },
  },
]);
