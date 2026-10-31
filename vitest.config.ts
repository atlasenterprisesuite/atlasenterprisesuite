import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // These suites use node:test and run through their dedicated Node runner.
    exclude: [...configDefaults.exclude, 'tests/node/**', 'tools/local-agent/tests/**'],
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts']
  }
});
