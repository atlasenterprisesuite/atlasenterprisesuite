import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./apps/web/src/test/setup.ts'],
    include: ['apps/**/*.test.{ts,tsx}', 'packages/**/*.test.ts']
  }
});
