import js from '@eslint/js';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import prettierConfig from 'eslint-config-prettier';
import importPlugin from 'eslint-plugin-import';
import jestPlugin from 'eslint-plugin-jest';
import prettierPlugin from 'eslint-plugin-prettier';

// Define globals for Node.js environment
const nodeGlobals = {
  console: 'readonly',
  process: 'readonly',
  __dirname: 'readonly',
  __filename: 'readonly',
  module: 'readonly',
  require: 'readonly',
  Buffer: 'readonly',
  setTimeout: 'readonly',
  clearTimeout: 'readonly',
  setInterval: 'readonly',
  clearInterval: 'readonly',
  global: 'readonly',
};

// Define Jest globals
const jestGlobals = {
  describe: 'readonly',
  expect: 'readonly',
  it: 'readonly',
  jest: 'readonly',
  test: 'readonly',
  beforeAll: 'readonly',
  beforeEach: 'readonly',
  afterAll: 'readonly',
  afterEach: 'readonly',
};

export default [
  js.configs.recommended,
  prettierConfig,
  {
    // Ignore non-TypeScript files and system files
    ignores: [
      'dist/**',
      'node_modules/**',
      'coverage/**',
      '**/*.js',
      '**/.env*',
      '**/.prettierrc',
      '**/.git*',
      '**/.husky/**',
      '**/*.md',
      '**/*.json',
      '**/*.lock',
      '**/*.log',
      '**/.DS_Store',
      '**/.eslintignore',
    ],
  },
  {
    files: ['**/*.ts', '!**/*.test.ts', '!jest.config.ts', '!tests/jest-setup.ts'],
    plugins: {
      '@typescript-eslint': tsPlugin,
      import: importPlugin,
      prettier: prettierPlugin,
    },
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: '.',
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
      // Add Node.js globals
      globals: {
        ...nodeGlobals,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      // General rules
      camelcase: [
        'error',
        {
          properties: 'never',
        },
      ],
      curly: ['error', 'all'],
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-else-return': ['error', { allowElseIf: false }],
      'no-console': 'off', // We're a CLI app, we need console
      'object-shorthand': ['error', 'always'],
      'prefer-const': 'error',
      'prefer-template': 'error',
      quotes: ['error', 'single', { avoidEscape: true }],
      semi: ['error', 'always'],
      // TypeScript rules
      '@typescript-eslint/explicit-function-return-type': 'off', // Inferred return types are usually fine
      '@typescript-eslint/explicit-module-boundary-types': 'off', // Same as above
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/ban-ts-comment': 'error',
      // Import rules
      'import/no-duplicates': 'error',
      'import/no-extraneous-dependencies': [
        'error',
        {
          devDependencies: ['**/*.test.ts', '**/*.spec.ts', '**/tests/**/*.ts', 'eslint.config.ts'],
        },
      ],
      'import/no-useless-path-segments': 'error',
      'import/order': 'off', // We'll use prettier-plugin-sort-imports instead
      // Prettier rules
      'prettier/prettier': 'error',
    },
  },
  {
    files: ['**/*.test.ts', 'jest.config.ts', 'tests/jest-setup.ts'],
    plugins: {
      '@typescript-eslint': tsPlugin,
      jest: jestPlugin,
      prettier: prettierPlugin,
    },
    settings: {
      'import/resolver': {
        typescript: {
          project: './tsconfig.test.json',
        },
      },
    },
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        // Use the test-specific TypeScript config
        project: './tsconfig.test.json',
        tsconfigRootDir: '.',
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
      // Add both Node.js and Jest globals for test files
      globals: {
        ...nodeGlobals,
        ...jestGlobals,
      },
    },
    rules: {
      // Relax rules for test files
      '@typescript-eslint/no-explicit-any': 'off',
      // Disable unused vars checking in test files - common in mocks and test setups
      '@typescript-eslint/no-unused-vars': 'off',
      'no-unused-vars': 'off',
      // Disable import/no-duplicates for tests since we often need to import from @jest/globals multiple times
      'import/no-duplicates': 'off',
      // Jest-specific rules
      'jest/no-disabled-tests': 'warn',
      'jest/no-focused-tests': 'error',
      'jest/no-identical-title': 'error',
      'jest/prefer-to-have-length': 'warn',
      'jest/valid-expect': 'error',
      // Prettier rules
      'prettier/prettier': 'error',
    },
  },
];
