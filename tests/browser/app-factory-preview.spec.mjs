// ATLAS 777 REVIEW — browser E2E contract, intentionally NOT included in Vitest.
// Run only against an isolated Vite preview of this PR's exact SHA.
// Requires a separately provisioned Playwright runner and browser binary.
// Never target production or a shared authenticated environment.
import { test, expect } from '@playwright/test';

test('App Factory srcDoc is isolated and never executes injected markup', async ({ page }) => {
  await page.goto('/work/app-factory');
  await expect(page.getByRole('heading', { name: /App Factory/ })).toBeVisible();
  await page.getByLabel('Application name').fill('<script>window.parent.__atlasInjected=1</script>');
  await page.getByLabel('Describe the idea').fill('<img src=x onerror="window.parent.__atlasInjected=1">');
  await page.getByRole('button', { name: 'Generate local concept preview' }).click();
  const frame = page.locator('iframe[title="Isolated application concept preview"]');
  await expect(frame).toHaveAttribute('sandbox', '');
  await expect(frame).toHaveAttribute('referrerpolicy', 'no-referrer');
  await expect(frame).toHaveAttribute('srcdoc', /Content-Security-Policy/);
  await expect(frame.contentFrame().getByText('Concept preview only — not deployed')).toBeVisible();
  expect(await page.evaluate(() => Object.hasOwn(window, '__atlasInjected'))).toBe(false);
});

test('preview is never a deployment or authenticated tenant action', async ({ page }) => {
  const calls = [];
  page.on('request', (request) => {
    if (/\/rest\/v1\/|\/functions\/v1\/|\/deploy/i.test(request.url())) calls.push(request.url());
  });
  await page.goto('/work/app-factory');
  await page.getByLabel('Describe the idea').fill('Inventory dashboard');
  await page.getByRole('button', { name: 'Generate local concept preview' }).click();
  await expect(page.getByText('Nothing has been saved or published.', { exact: false })).toBeVisible();
  expect(calls).toEqual([]);
});
