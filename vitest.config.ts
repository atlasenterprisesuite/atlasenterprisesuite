import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // These files use node:test and are executed by npm run test:node.
    exclude: [...configDefaults.exclude, 'tests/node/**', 'tools/local-agent/tests/**'],
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts']
  }
});
