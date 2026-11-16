import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Verification tooling only. The application's dependency set is unchanged.
const modulePath = process.env.ATLAS_PLAYWRIGHT_MODULE;
const { chromium } = await import(modulePath ? pathToFileURL(resolve(modulePath)).href : 'playwright');
const base = new URL(process.env.ATLAS_RECONCILIATION_BASE_URL || 'http://127.0.0.1:4173');
assert.ok(base.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(base.hostname), 'Browser fixtures may only run against a local preview.');
const output = resolve(process.env.ATLAS_RECONCILIATION_OUTPUT || '.tmp/accounting-reconciliation-browser');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const context = await browser.newContext({ viewport: { width: 1440, height: 1080 }, acceptDownloads: true });
const page = await context.newPage();
const pageErrors = [];
const mutatingRequests = [];
page.on('pageerror', error => pageErrors.push(error.message));
page.on('request', request => {
  if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method())) mutatingRequests.push({ method: request.method(), url: request.url() });
});
await context.route('**/*', route => new URL(route.request().url()).origin === base.origin ? route.continue() : route.abort());

try {
  await page.goto(new URL('/finance/accounting', base).href, { waitUntil: 'networkidle' });
  await page.locator('main a[href="/finance/accounting/reconciliation"]').first().click();
  await page.getByRole('heading', { name: 'Conciliación de archivos' }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Comparar movimientos' }).isEnabled(), false);

  const header = '\ufeffid,date,amount,currency,reference,description\r\n';
  const bank = Buffer.from(header + 'TEST-B1,2026-11-01,-12.30,USD,INV-TEST,Prueba sintética\r\nTEST-B2,2026-11-03,100.00,USD,SALE-TEST,Prueba sintética');
  const ledger = Buffer.from(header + 'TEST-L1,2026-11-02,-12.30,USD,inv-test,Prueba sintética\r\nTEST-L2,2026-11-03,99.00,USD,SALE-TEST,Prueba sintética');
  await page.getByLabel('Archivo del banco', { exact: true }).setInputFiles({ name: 'TEST_bank.csv', mimeType: 'text/csv', buffer: bank });
  await page.getByLabel('Archivo del libro contable', { exact: true }).setInputFiles({ name: 'TEST_ledger.csv', mimeType: 'text/csv', buffer: ledger });
  await page.getByRole('button', { name: 'Comparar movimientos' }).click();
  await page.getByRole('heading', { name: 'Resultado pendiente de revisión' }).waitFor();
  assert.match(await page.getByLabel('Cantidad de propuestas', { exact: true }).innerText(), /1/);
  assert.match(await page.getByLabel('Diferencia entre totales', { exact: true }).innerText(), /\$1\.00/);

  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Descargar evidencia JSON' }).click();
  const download = await downloadEvent;
  const evidencePath = resolve(output, 'TEST-local-report.json');
  await download.saveAs(evidencePath);
  const report = JSON.parse(await readFile(evidencePath, 'utf8'));
  assert.equal(report.sources.bank.sha256, createHash('sha256').update(bank).digest('hex'));
  assert.equal(report.result.proposals[0].bankId, 'TEST-B1');
  assert.equal(report.result.totals.differenceMinor, 100);
  assert.equal(report.reviewState, 'requires_human_review');
  assert.equal(report.bankConnected, false);
  assert.equal(report.posted, false);

  const screens = [];
  for (const [name, width, height] of [['desktop', 1440, 1080], ['tablet', 768, 1024], ['mobile', 390, 844]]) {
    await page.setViewportSize({ width, height });
    const dimensions = await page.evaluate(() => ({ viewport: innerWidth, scroll: document.documentElement.scrollWidth }));
    assert.ok(dimensions.scroll <= dimensions.viewport, `${name} page overflows horizontally: ${JSON.stringify(dimensions)}`);
    await page.screenshot({ path: resolve(output, `${name}.png`), fullPage: true });
    screens.push({ name, width, height, ...dimensions });
  }

  await page.getByLabel('Archivo del banco', { exact: true }).setInputFiles([]);
  assert.equal(await page.getByRole('button', { name: 'Comparar movimientos' }).isEnabled(), false);
  assert.equal(await page.getByRole('button', { name: 'Descargar evidencia JSON' }).count(), 0);
  await page.getByLabel('Archivo del banco', { exact: true }).setInputFiles({ name: 'TEST_invalid.csv', mimeType: 'text/csv', buffer: Buffer.from(header + 'TEST-X,2026-02-30,1,USD,R1,Prueba sintética') });
  await page.getByRole('alert').filter({ hasText: 'Fecha inválida' }).waitFor();
  await page.getByRole('button', { name: 'Borrar archivos y resultado' }).click();
  assert.equal(await page.getByRole('alert').count(), 0);
  assert.equal(await page.getByRole('button', { name: 'Comparar movimientos' }).isEnabled(), false);
  assert.deepEqual(pageErrors, []);
  assert.deepEqual(mutatingRequests, []);

  const result = { ok: true, environment: 'local_production_preview', sourceSha: process.env.GITHUB_SHA || null, route: '/finance/accounting/reconciliation', navigationFromAccounting: true, importCompareExportRemoveInvalidClear: true, originalBytesSha256: true, screens, pageErrors, mutatingRequests, fixture: 'synthetic verification data only; no production claim' };
  await writeFile(resolve(output, 'verification.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  await page.screenshot({ path: resolve(output, 'failure.png'), fullPage: true }).catch(() => undefined);
  await writeFile(resolve(output, 'verification.json'), JSON.stringify({ ok: false, error: String(error), pageErrors, mutatingRequests }, null, 2));
  throw error;
} finally {
  await browser.close();
}
