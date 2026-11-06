import { defineConfig } from '@playwright/test';

// P0: This suite can only run on an explicitly allowed, exact-SHA deployment.
// All secrets are supplied by the authorized test runner; never store them in code.
const required = [
  'ATLAS_E2E_BASE_URL',
  'ATLAS_E2E_ALLOWED_ORIGIN',
  'ATLAS_E2E_EXPECTED_SHA',
  'ATLAS_E2E_EMAIL',
  'ATLAS_E2E_PASSWORD'
];
for (const name of required) {
  if (!process.env[name]?.trim()) throw new Error(`P0: missing ${name}`);
}
const target = new URL(process.env.ATLAS_E2E_BASE_URL);
const allowed = new URL(process.env.ATLAS_E2E_ALLOWED_ORIGIN);
if (target.protocol !== 'https:' || allowed.protocol !== 'https:'
    || target.origin !== allowed.origin || target.username || target.password
    || target.pathname !== '/' || target.search || target.hash) {
  throw new Error('P0: untrusted E2E target; origin allowlist/HTTPS/root mismatch');
}
if (!/^[0-9a-f]{40}$/i.test(process.env.ATLAS_E2E_EXPECTED_SHA)) {
  throw new Error('P0: expected SHA must be 40 hex characters');
}

export default defineConfig({
  testDir: '.',
  testMatch: /gps-earth-authenticated\.e2e\.mjs$/,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['line']],
  use: {
    baseURL: target.origin,
    browserName: 'webkit',
    headless: true,
    ignoreHTTPSErrors: false,
    screenshot: 'off',
    trace: 'off',
    video: 'off'
  }
});
