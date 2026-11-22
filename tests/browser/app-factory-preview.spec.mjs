// ATLAS 777 REVIEW — browser E2E contract, intentionally NOT included in Vitest.
// Run only against an isolated Vite preview of this PR's exact SHA.
// Requires a separately provisioned Playwright runner and browser binary.
// Never target production or a shared authenticated environment.
import { test, expect } from '@playwright/test';

// All membership responses in this browser contract are synthetic.
// Never send fixture credentials or requests to a real backend.
async function isolateBackend(page, membershipAllowed) {
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
      return route.continue();
    }
    if (url.pathname === '/rest/v1/organization_members') {
      const headers = {
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'GET, OPTIONS',
        'access-control-allow-headers': 'authorization, apikey, content-type'
      };
      if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
      return route.fulfill({ status: 200, headers, json: membershipAllowed ? [{
        org_id: 'fixture_org', role: 'member', status: 'active',
        organizations: { id: 'fixture_org', name: 'Fixture organization', active: true }
      }] : [] });
    }
    return route.abort();
  });
}

async function signInFixture(page, membershipAllowed = true) {
  await isolateBackend(page, membershipAllowed);
  await page.addInitScript(() => {
    if (['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)) {
      localStorage.setItem('atlas_access_token', 'synthetic-browser-fixture');
    }
  });
}

test('anonymous users are redirected to identity before opening App Factory', async ({ page }) => {
  await isolateBackend(page, false);
  await page.goto('/work/app-factory');
  await expect(page).toHaveURL(/\/identity\?app=/);
  await expect(page.getByLabel('Describe the idea')).toHaveCount(0);
});

test('a session without active membership cannot open App Factory', async ({ page }) => {
  await signInFixture(page, false);
  await page.goto('/work/app-factory');
  await expect(page).toHaveURL(/\/identity\?app=/);
  await expect(page.getByLabel('Describe the idea')).toHaveCount(0);
});


test('App Factory srcDoc is isolated and never executes injected markup', async ({ page }) => {
  await signInFixture(page);
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
  await signInFixture(page);
  const calls = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    const method = request.method();
    const backendWrite = /\/(rest|functions)\/v1\//i.test(url.pathname) && !['GET', 'HEAD', 'OPTIONS'].includes(method);
    const deploymentMutation = /\/(deploy|deployments)(?:\/|$)/i.test(url.pathname) && !['GET', 'HEAD', 'OPTIONS'].includes(method);
    if (backendWrite || deploymentMutation) calls.push(`${method} ${url.pathname}`);
  });
  await page.goto('/work/app-factory');
  await page.getByLabel('Describe the idea').fill('Inventory dashboard');
  await page.getByRole('button', { name: 'Generate local concept preview' }).click();
  await expect(page.getByText('Nothing has been saved or published.', { exact: false })).toBeVisible();
  expect(calls).toEqual([]);
});
