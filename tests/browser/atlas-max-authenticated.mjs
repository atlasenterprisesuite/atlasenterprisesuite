/**
 * Isolated browser certification for the /max UI.
 *
 * A synthetic ATLAS session and an intercepted Supabase origin are used only
 * in GitHub CI. No production user credentials, external network calls,
 * real backend grants or commercial entitlements are involved.
 *
 * This tests browser behavior and Axe, not an actual production identity.
 */
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';

const ORIGIN = 'http://127.0.0.1:4173';
const API = 'https://ggmanzcgtlrvqfoccgsh.supabase.co';
const ORG = 'atlas-max-ci-organization';
const other = 'atlas-max-other-organization';
const outputDir = 'artifacts/atlas-max-browser';
await mkdir(outputDir, { recursive: true });

const status = (organization) => ({
  ok: true, authenticated: true, organization, role: 'owner',
  provider: 'atlas-local', provider_state: 'verified_for_request',
  model: 'test-model', storage_state: 'configured', capabilities: ['generation'],
  providers: [
    { id: 'atlas-local', state: 'verified', configured: true, verified: true,
      model: 'test-model', capabilities: ['generation'], profiles: ['balanced'], error: null }
  ]
});
const usage = {
  ok: true, scope: 'organization', days: 30,
  period_start: '2026-10-07T00:00:00Z',
  period_end: '2026-11-06T00:00:00Z',
  total_requests: 13, completed_requests: 12, failed_requests: 1,
  average_latency_ms: 120, automatic_api_cost_usd: 0,
  tokens: { input: 0, output: 0, total: 0 }, providers: [], models: []
};

function json(route, body, statusCode = 200) {
  return route.fulfill({
    status: statusCode,
    contentType: 'application/json',
    headers: {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET, POST, OPTIONS',
      'access-control-allow-headers': '*',
      'cache-control': 'no-store'
    },
    body: JSON.stringify(body)
  });
}

async function installNetworkFixture(context, fixture) {
  // Block all non-local requests except precisely modeled, intercepted API paths.
  await context.route('**/*', async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === ORIGIN) return route.continue();
    if (url.origin !== API) return route.abort('blockedbyclient');
    if (request.method() === 'OPTIONS') return json(route, {});
    if (url.pathname === '/rest/v1/organization_members' && request.method() === 'GET') {
      fixture.membershipCalls += 1;
      if (!fixture.membershipAllowed) return json(route, { error: 'membership_revoked' }, 403);
      return json(route, [{
        org_id: ORG, role: 'owner', status: 'active',
        organizations: { id: ORG, name: 'ATLAS CI Fixture', legal_name: null, active: true }
      }]);
    }
    if (url.pathname === '/functions/v1/atlas-copilot' && request.method() === 'GET') {
      const api = url.searchParams.get('api');
      if (api === 'status') {
        fixture.statusCalls += 1;
        return json(route, status(fixture.statusOrg));
      }
      if (api === 'usage') {
        fixture.usageCalls += 1;
        return json(route, usage);
      }
    }
    // Fail closed. A new request cannot accidentally reach a live provider.
    return json(route, { error: 'fixture_endpoint_not_permitted' }, 403);
  });
}

async function checkViewport(browser, width, height) {
  const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce' });
  const fixture = { membershipAllowed: true, membershipCalls: 0, statusOrg: ORG, statusCalls: 0, usageCalls: 0 };
  await installNetworkFixture(context, fixture);
  await context.addInitScript(() => {
    localStorage.setItem('atlas_access_token', 'ATLAS-SYNTHETIC-CI-NOT-A-REAL-TOKEN');
  });

  const page = await context.newPage();
  await page.goto(`${ORIGIN}/max`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'ATLAS MAX', exact: true, level: 1 }).waitFor({ timeout: 20_000 });
  await page.getByText('Authenticated snapshot', { exact: true }).waitFor({ timeout: 20_000 });

  assert.ok(fixture.membershipCalls > 0, 'canonical membership API must be checked');
  assert.ok(fixture.statusCalls > 0, 'gateway status endpoint must be checked');
  assert.ok(fixture.usageCalls > 0, 'gateway usage endpoint must be checked');
  assert.equal(await page.getByText('atlas-local', { exact: true }).count(), 1);
  assert.ok(await page.getByText('ATLAS MAX status unavailable').isVisible(), 'MAX entitlement must remain unknown');
  assert.equal(await page.getByRole('progressbar').count(), 0, 'gateway requests cannot become MAX quota');

  await page.getByRole('button', { name: /creative production/i }).click();
  assert.equal(await page.getByRole('link', { name: /open atlas studio/i }).getAttribute('href'), '/studio');

  const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  assert.equal(horizontalOverflow, false, `horizontal overflow at ${width}px`);
  await page.screenshot({ path: `${outputDir}/max-authenticated-${width}.png`, fullPage: true });

  const a11y = await new AxeBuilder({ page }).withTags([
    'wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22a', 'wcag22aa', 'best-practice'
  ]).analyze();
  if (a11y.violations.length) {
    throw new Error(`MAX Axe violations at ${width}px: ${JSON.stringify(a11y.violations.map(v => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.map(n => ({ target: n.target, html: n.html.slice(0, 450), failureSummary: n.failureSummary })) })))}`);
  }
  console.log(`PASS authenticated simulated /max: ${width}x${height}; axe 0 violations`);

  const beforeRefresh = fixture.statusCalls;
  await page.getByRole('button', { name: /refresh gateway evidence/i }).click();
  await page.waitForFunction(() => document.body.textContent?.includes('Authenticated snapshot'));
  await page.waitForTimeout(120);
  assert.ok(fixture.statusCalls > beforeRefresh, 'refresh must fetch gateway status again');

  // Tenant mismatch must remove old provider information without granting MAX.
  fixture.statusOrg = other;
  await page.getByRole('button', { name: /refresh gateway evidence/i }).click();
  await page.getByText('No verified readiness can be displayed at this time.').waitFor({ timeout: 15_000 });
  assert.equal(await page.getByText('atlas-local', { exact: true }).count(), 0);
  assert.ok(await page.getByText('ATLAS MAX status unavailable').isVisible());

  await context.close();
}

async function checkUnauthenticated(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const fixture = { membershipAllowed: true, membershipCalls: 0, statusOrg: ORG, statusCalls: 0, usageCalls: 0 };
  await installNetworkFixture(context, fixture);
  const page = await context.newPage();
  await page.goto(`${ORIGIN}/max`, { waitUntil: 'domcontentloaded' });
  await page.waitForURL(/\/identity\?app=/, { timeout: 20_000 });
  assert.equal(fixture.statusCalls, 0);
  assert.equal(fixture.usageCalls, 0);
  console.log('PASS unauthenticated /max requires ATLAS Identity');
  await context.close();
}

async function checkRevokedMembership(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const fixture = { membershipAllowed: false, membershipCalls: 0, statusOrg: ORG, statusCalls: 0, usageCalls: 0 };
  await installNetworkFixture(context, fixture);
  await context.addInitScript(() => {
    localStorage.setItem('atlas_access_token', 'ATLAS-SYNTHETIC-CI-NOT-A-REAL-TOKEN');
  });
  const page = await context.newPage();
  await page.goto(`${ORIGIN}/max`, { waitUntil: 'domcontentloaded' });
  await page.waitForURL(/\/identity\?app=/, { timeout: 20_000 });
  assert.ok(fixture.membershipCalls > 0);
  assert.equal(fixture.statusCalls, 0);
  assert.equal(fixture.usageCalls, 0);
  console.log('PASS revoked synthetic membership denies MAX workspace');
  await context.close();
}

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
try {
  await checkUnauthenticated(browser);
  await checkRevokedMembership(browser);
  for (const [width, height] of [[320, 720], [768, 1024], [1440, 900]]) {
    await checkViewport(browser, width, height);
  }
  console.log('ATLAS MAX isolated authenticated browser certification PASSED');
} finally {
  await browser.close();
}
