import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    // Node's test runner owns these suites; execute them through npm test.
    exclude: [...configDefaults.exclude, 'tools/local-agent/tests/**', 'tools/atlas-os/tests/**', 'tests/node/**'],
    globals: true,
    setupFiles: ['./tests/setup.ts']
  }
});
