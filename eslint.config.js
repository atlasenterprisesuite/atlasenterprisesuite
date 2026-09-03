import js from '@eslint/js';
import tseslint from 'typescript-eslint';

const sharedGlobals = {
  console: 'readonly',
  document: 'readonly',
  window: 'readonly',
  URL: 'readonly',
  process: 'readonly',
  setTimeout: 'readonly',
  clearTimeout: 'readonly'
};

export default tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**']
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx,mjs,js}'],
    languageOptions: {
      globals: sharedGlobals
    },
    rules: {
      'no-console': ['error', { allow: ['warn', 'error', 'log'] }],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }]
    }
  },
  {
    files: ['**/*.test.{ts,tsx}'],
    rules: {
      'no-console': 'off'
    }
  }
);
