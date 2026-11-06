/**
 * Isolated browser Axe gate for the real Bible OS Jesus panel.
 * Strictly local Vite preview + intercepted .invalid Supabase test endpoint only.
 * Never touches live Supabase, uses real authentication UI/guard with synthetic fixtures.
 */
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import axe from 'axe-core';

const ORIGIN = 'http://127.0.0.1:4173';
const FAKE_SUPABASE = 'https://atlas-bible-e2e.invalid';
const EMAIL = 'atlas-browser-e2e@example.invalid';
const PASSWORD = 'isolated-browser-e2e-password';
const TOKEN = 'isolated-bible-browser-token';
const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22a', 'wcag22aa', 'best-practice'];

async function checkScenario(browser, activeOrganization) {
  const context = await browser.newContext({ serviceWorkers: 'block' });
  const rejected = [];
  let loginRequests = 0;
  let membershipRequests = 0;
  try {
    await context.route('**/*', async (route) => {
      const request = route.request();
      const url = new URL(request.url());

      if (url.origin === ORIGIN) {
        await route.continue();
        return;
      }

      if (url.origin === FAKE_SUPABASE && request.method() === 'POST'
        && url.pathname === '/auth/v1/token' && url.searchParams.get('grant_type') === 'password') {
        const payload = request.postDataJSON();
        if (payload?.email !== EMAIL || payload?.password !== PASSWORD) {
          rejected.push('Unexpected synthetic login payload');
          await route.abort();
          return;
        }
        loginRequests += 1;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ access_token: TOKEN, refresh_token: 'isolated-refresh-token' })
        });
        return;
      }

      if (url.origin === FAKE_SUPABASE && request.method() === 'GET'
        && url.pathname === '/rest/v1/organization_members') {
        if (request.headers().authorization !== 'Bearer ' + TOKEN) {
          rejected.push('Organization lookup missing synthetic bearer');
          await route.abort();
          return;
        }
        membershipRequests += 1;
        const body = activeOrganization
          ? [{ org_id: 'isolated-e2e-organization', role: 'member', status: 'active',
            organizations: { id: 'isolated-e2e-organization', name: 'Isolated E2E', active: true } }]
          : [];
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
        return;
      }

      // Existing ATLAS Shell requests assistant status after organization validation.
      // Keep that status deliberately unconfigured; this is NOT a live provider session.
      if (url.origin === FAKE_SUPABASE && request.method() === 'GET'
        && url.pathname === '/functions/v1/atlas-copilot'
        && url.searchParams.get('api') === 'status') {
        const headers = request.headers();
        if (headers.authorization !== 'Bearer ' + TOKEN
          || headers['x-atlas-org-id'] !== 'isolated-e2e-organization') {
          rejected.push('Assistant status requested without the authorized synthetic organization');
          await route.abort();
          return;
        }
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: true, authenticated: true, provider: 'none',
            provider_state: 'not_configured', model: null,
            storage_state: 'not_configured', organization: 'isolated-e2e-organization',
            role: 'member', capabilities: [], providers: []
          })
        });
        return;
      }

      // Fail closed: any production provider, CDN or unrecognized backend request.
      rejected.push('Unexpected network request: ' + request.method() + ' ' + url.origin + url.pathname);
      await route.abort();
    });

    const page = await context.newPage();
    await page.goto(ORIGIN + '/knowledge/bible', { waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: 'ATLAS Identity', exact: true }).waitFor();
    assert.equal(await page.getByRole('heading', { name: 'ATLAS Bible OS' }).count(), 0,
      'Protected Bible OS appeared before login');

    await page.getByLabel('Email', { exact: true }).fill(EMAIL);
    await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
    await page.getByRole('button', { name: 'Sign in to ATLAS' }).click();

    if (activeOrganization) {
      await page.getByRole('heading', { name: 'ATLAS Bible OS', exact: true }).waitFor();
      assert.equal(await page.getByRole('heading', { name: 'Life and teachings of Jesus' }).count(), 0,
        'Opt-in Jesus panel shown by default');
      const control = page.getByRole('button', { name: 'Life & Teachings of Jesus', exact: true });
      assert.equal(await control.getAttribute('aria-pressed'), 'false');
      await control.focus();
      await page.keyboard.press('Enter'); // Native keyboard activation, not a synthetic click.
      await page.getByRole('heading', { name: 'Life and teachings of Jesus', exact: true }).waitFor();
      assert.equal(await control.getAttribute('aria-pressed'), 'true');
      assert.ok(await page.getByRole('list', { name: 'Evidence sources' }).count() > 0,
        'The real Jesus evidence list did not mount');

      const panel = page.locator('section[aria-labelledby="bible-os-jesus-heading"]');
      assert.equal(await panel.count(), 1, 'Jesus panel not rendered');
      await page.addScriptTag({ content: axe.source });
      const results = await page.evaluate(async (tags) => {
        if (!window.axe) throw new Error('Axe did not load into the authenticated Bible OS view');
        const selected = document.querySelector('section[aria-labelledby="bible-os-jesus-heading"]');
        if (!selected) throw new Error('Jesus panel disappeared before Axe scan');
        return window.axe.run(selected, { runOnly: { type: 'tag', values: tags } });
      }, AXE_TAGS);
      const summary = {
        actualPanel: true,
        rulesPassed: results.passes.length,
        violations: results.violations.map(v => ({
          id: v.id, impact: v.impact, help: v.help,
          nodes: v.nodes.map(n => n.target).slice(0, 8)
        })),
        incomplete: results.incomplete.map(v => v.id)
      };
      console.log('BIBLE_OS_JESUS_AXE_BROWSER', JSON.stringify(summary));
      assert.equal(results.violations.length, 0, 'Axe WCAG/best-practice violations found in the real Jesus panel');
    } else {
      await page.getByText('Your account is authenticated but has no active ATLAS organization access.').waitFor();
      assert.equal(await page.getByRole('heading', { name: 'ATLAS Bible OS' }).count(), 0,
        'Bible OS rendered without active organization');
      assert.equal(await page.evaluate(() => localStorage.getItem('atlas_access_token')), null,
        'Denied user retained an access token');
      console.log('BIBLE_OS_JESUS_DENIED_BROWSER', 'active organization required; session cleared');
    }

    assert.ok(loginRequests >= 1, 'Browser fixture never passed through ATLAS Identity login');
    assert.ok(membershipRequests >= 1, 'Browser fixture did not verify organization membership');
    assert.deepEqual(rejected, [], 'External or unknown network calls were attempted');
  } finally {
    await context.close();
  }
}

const browser = await chromium.launch({ headless: true });
try {
  await checkScenario(browser, true);
  await checkScenario(browser, false);
  console.log('BIBLE_OS_JESUS_BROWSER_GATE', 'PASS');
} finally {
  await browser.close();
}
