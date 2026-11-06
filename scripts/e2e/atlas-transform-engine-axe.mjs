/**
 * ATLAS 777: isolated authenticated browser/Axe gate for Transform Engine.
 * Never uses live accounts, production credentials, or external connections.
 * The test image is a synthetic colored 3x3 PNG, NOT the production asset.
 */
import assert from 'node:assert/strict';
import { deflateSync } from 'node:zlib';
import { chromium } from 'playwright';
import axe from 'axe-core';

const ORIGIN = 'http://127.0.0.1:4173';
const FAKE = 'https://atlas-transform-e2e.invalid';
const EMAIL = 'atlas-transform-browser@example.invalid';
const PASSWORD = 'isolated-transform-test-only-password';
const TOKEN = 'isolated-transform-browser-token';
const ASSET = '/atlas/transform/frames.png';
const tags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22a', 'wcag22aa'];

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, payload) {
  const tag = Buffer.from(type);
  const size = Buffer.alloc(4);
  size.writeUInt32BE(payload.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([tag, payload])));
  return Buffer.concat([size, tag, payload, checksum]);
}
function makeSyntheticGrid() {
  const width = 477, height = 357, rowBytes = width * 4 + 1;
  const pixels = Buffer.alloc(rowBytes * height);
  for (let y = 0; y < height; y++) {
    const start = rowBytes * y;
    pixels[start] = 0;
    for (let x = 0; x < width; x++) {
      const index = Math.floor(y / 119) * 3 + Math.floor(x / 159);
      const p = start + 1 + x * 4;
      pixels[p] = 34 + index * 19;
      pixels[p + 1] = 74 + index * 12;
      pixels[p + 2] = 126 + index * 10;
      pixels[p + 3] = 255;
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0); header.writeUInt32BE(height, 4);
  header[8] = 8; header[9] = 6;
  return Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), chunk('IHDR', header), chunk('IDAT', deflateSync(pixels)), chunk('IEND', Buffer.alloc(0))]);
}
async function scenario(browser, activeOrg) {
  const context = await browser.newContext({ serviceWorkers: 'block' });
  const unexpected = [];
  let logins = 0, memberships = 0, imageRequests = 0;
  try {
    const image = makeSyntheticGrid();
    await context.route('**/*', async route => {
      const req = route.request(), url = new URL(req.url());
      if (url.origin === ORIGIN && url.pathname === ASSET) {
        imageRequests++;
        await route.fulfill({ status: 200, body: image, contentType: 'image/png' });
        return;
      }
      if (url.origin === ORIGIN) { await route.continue(); return; }
      if (url.origin === FAKE && req.method() === 'POST' && url.pathname === '/auth/v1/token' && url.searchParams.get('grant_type') === 'password') {
        assert.equal(req.postDataJSON()?.email, EMAIL);
        assert.equal(req.postDataJSON()?.password, PASSWORD);
        logins++;
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access_token: TOKEN, refresh_token: 'isolated-test-refresh' }) });
        return;
      }
      if (url.origin === FAKE && req.method() === 'GET' && url.pathname === '/rest/v1/organization_members') {
        assert.equal(req.headers().authorization, 'Bearer ' + TOKEN);
        memberships++;
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(activeOrg ? [{ org_id: 'isolated-org', role: 'member', status: 'active', organizations: { id: 'isolated-org', name: 'E2E', active: true } }] : []) });
        return;
      }
      if (url.origin === FAKE && req.method() === 'GET' && url.pathname === '/functions/v1/atlas-copilot' && url.searchParams.get('api') === 'status') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, authenticated: true, provider: 'none', provider_state: 'not_configured', model: null, storage_state: 'not_configured', organization: 'isolated-org', role: 'member', capabilities: [], providers: [] }) });
        return;
      }
      if (url.origin === FAKE && req.method() === 'GET' && (url.pathname === '/functions/v1/atlas-creator' || url.pathname === '/functions/v1/atlas-creator-native')) {
        assert.equal(req.headers().authorization, 'Bearer ' + TOKEN);
        await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'isolated_provider_unavailable' }) });
        return;
      }
      unexpected.push(req.method() + ' ' + url.origin + url.pathname);
      await route.abort();
    });

    const page = await context.newPage();
    await page.goto(ORIGIN + '/studio/create?type=video', { waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: 'ATLAS Identity', exact: true }).waitFor();
    assert.equal(await page.getByRole('heading', { name: 'ATLAS Director' }).count(), 0, 'protected Director was exposed before authentication');
    await page.getByLabel('Email', { exact: true }).fill(EMAIL);
    await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
    await page.getByRole('button', { name: 'Sign in to ATLAS' }).click();

    if (activeOrg) {
      await page.getByRole('heading', { name: 'ATLAS Director', exact: true }).waitFor();
      const rail = page.getByRole('navigation', { name: 'Production steps' });
      await rail.getByRole('button', { name: 'Motion Designer' }).click();
      const panel = page.getByRole('complementary', { name: 'ATLAS Transform Engine preview (isolated test)' });
      await panel.getByRole('heading', { name: 'ATLAS Transform Engine · isolated preview' }).waitFor();
      assert.ok(imageRequests > 0, 'isolated binary fixture was not requested');
      const next = panel.getByRole('button', { name: 'Siguiente' });
      await next.waitFor({ state: 'visible' });
      // A trial click waits for enabled/actionable without activating the control.
      await next.click({ trial: true });
      await next.focus();
      await page.keyboard.press('Enter');
      await panel.getByRole('img', { name: /fotograma 2 de 9/ }).waitFor();
      await panel.getByRole('button', { name: 'Anterior' }).click();
      await panel.getByRole('img', { name: /fotograma 1 de 9/ }).waitFor();
      assert.equal(await page.getByText(/Native motion render stays disabled until/).count() > 0, true, 'render readiness notice missing');
      await page.addScriptTag({ content: axe.source });
      const result = await panel.evaluate(async (element, tagList) => window.axe.run(element, { runOnly: { type: 'tag', values: tagList } }), tags);
      console.log('TRANSFORM_PREVIEW_AXE', JSON.stringify({ violations: result.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target).slice(0, 5) })), incomplete: result.incomplete.map(v => v.id), passes: result.passes.length }));
      assert.equal(result.violations.length, 0, 'Axe found a preview accessibility violation');
    } else {
      await page.getByText('Your account is authenticated but has no active ATLAS organization access.').waitFor();
      assert.equal(await page.getByRole('heading', { name: 'ATLAS Director' }).count(), 0, 'Director appeared without organization');
      assert.equal(await page.evaluate(() => localStorage.getItem('atlas_access_token')), null, 'denied session token remains');
      assert.equal(imageRequests, 0, 'restricted preview image was fetched without active organization');
    }
    assert.ok(logins >= 1 && memberships >= 1, 'did not use actual ATLAS Identity UI and membership lookup');
    assert.deepEqual(unexpected, [], 'unexpected external network requests');
  } finally {
    await context.close();
  }
}
const browser = await chromium.launch({ headless: true });
try {
  await scenario(browser, true);
  await scenario(browser, false);
  console.log('ATLAS_TRANSFORM_AUTH_BROWSER_GATE: PASS');
} finally { await browser.close(); }
