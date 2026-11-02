import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: '../../../tests/browser',
  testMatch: 'app-factory-preview.spec.mjs',
  fullyParallel: false,
  retries: 0,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  use: { baseURL: 'http://127.0.0.1:4173', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }]
});
