import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // These suites use node:test and must run with Node, not Vitest.
    exclude: [...configDefaults.exclude, 'tests/node/**', 'tools/local-agent/tests/**'],
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts']
  }
});
