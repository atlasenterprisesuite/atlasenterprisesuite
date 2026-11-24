import test from 'node:test';
import assert from 'node:assert/strict';
import {
  APPLE_SOFTWARE_LOOKUP_URL,
  normalizeAppleCatalog,
  compareAppleCatalog,
  inspectAppleSoftwareReleases
} from '../../packages/security/src/appleSecurityRadar.mjs';

const a = (version, build = '24A100') => ({
  ProductVersion: version, Build: build, PostingDate: '2026-11-09',
  ExpirationDate: '2027-02-01', SupportedDevices: ['iPhone18,1', 'iPhone18,2']
});
const catalog = (entries = [a('27.2.1')]) => ({
  PublicAssetSets: { iOS: entries, macOS: [a('27.2.1', '26B300')] },
  AssetSets: { iOS: [a('27.3', '24BETA')] },
  PublicBackgroundSecurityImprovements: { iOS: [a('27.2.1 (a)')] }
});
const fakeFetch = (body, options = {}) => async (_url, init) => {
  assert.equal(_url, APPLE_SOFTWARE_LOOKUP_URL);
  assert.equal(init.redirect, 'error');
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), {
    status: options.status ?? 200,
    headers: { 'content-type': 'application/json' }
  });
};

test('reads only public releases, without pretending to assess CVEs or device status', async () => {
  const output = await inspectAppleSoftwareReleases({
    fetchImpl: fakeFetch(catalog()),
    now: new Date('2026-11-24T15:00:00.000Z')
  });
  assert.equal(output.result.baselineCreated, true);
  assert.equal(output.result.changeCount, 0);
  assert.equal(output.result.releaseCount, 2);
  assert.equal(output.result.verifiedSourceRetrieval, true);
  assert.equal(output.result.cveCorrelationVerified, false);
  assert.equal(output.result.deviceComplianceVerified, false);
  assert.equal(output.result.productionVerified, false);
  assert.deepEqual(output.nextState.releases.map(x => x.platform), ['iOS', 'macOS']);
  assert.match(output.nextState.rawResponseSha256, /^[a-f0-9]{64}$/);
});

test('produces a review-only change after the initial baseline', async () => {
  const base = await inspectAppleSoftwareReleases({ fetchImpl: fakeFetch(catalog()) });
  const update = await inspectAppleSoftwareReleases({
    previousState: base.nextState,
    fetchImpl: fakeFetch(catalog([a('27.2.1'), a('27.2.2', '24A200')]))
  });
  assert.equal(update.result.baselineCreated, false);
  assert.equal(update.result.changeCount, 1);
  assert.equal(update.result.changes[0].type, 'release_observed');
  assert.equal(update.result.changes[0].cveStatus, 'not_evaluated');
  assert.equal(update.result.changes[0].automatedRemediation, false);
});

test('detects changed supported-device metadata without creating another release', async () => {
  const base = await inspectAppleSoftwareReleases({ fetchImpl: fakeFetch(catalog()) });
  const modified = catalog();
  modified.PublicAssetSets.iOS[0].SupportedDevices = ['iPhone18,2'];
  const update = await inspectAppleSoftwareReleases({
    previousState: base.nextState, fetchImpl: fakeFetch(modified)
  });
  assert.equal(update.result.changeCount, 1);
  assert.equal(update.result.changes[0].type, 'release_metadata_changed');
});

test('canonical normalization ignores device order', () => {
  const left = normalizeAppleCatalog(catalog());
  const right = catalog();
  right.PublicAssetSets.iOS[0].SupportedDevices.reverse();
  assert.deepEqual(normalizeAppleCatalog(right), left);
});

test('rejects missing or unexpected schema instead of reporting zero updates', () => {
  assert.throws(() => normalizeAppleCatalog({}), /missing_public_assets/);
  assert.throws(() => normalizeAppleCatalog({ PublicAssetSets: { tvOS: [] } }), /empty_or_unrecognized/);
  assert.throws(() => normalizeAppleCatalog(catalog([{ ...a('27.2'), PostingDate: '2026-02-31' }])), /invalid_date/);
  assert.throws(() => normalizeAppleCatalog(catalog([{ ...a('27.2'), SupportedDevices: ['bad device id'] }])), /invalid_device_list/);
});

test('fails closed on untrusted previously saved state', () => {
  const nextState = { releases: normalizeAppleCatalog(catalog()).releases };
  assert.throws(() => compareAppleCatalog({ schemaVersion: 1, sourceUrl: 'https://attacker.invalid', releases: [] }, nextState), /untrusted/);
});

test('rejects HTTP errors and non-JSON provider responses', async () => {
  await assert.rejects(
    inspectAppleSoftwareReleases({ fetchImpl: fakeFetch('{}', { status: 502 }) }),
    /http_or_redirect_failure/
  );
  await assert.rejects(
    inspectAppleSoftwareReleases({ fetchImpl: fakeFetch('not JSON') }),
    /invalid_json/
  );
});

test('tracks new platform names for review rather than silently declaring coverage', () => {
  const data = catalog();
  data.PublicAssetSets.audioOS = [a('27.2')];
  const result = normalizeAppleCatalog(data);
  assert.deepEqual(result.unreviewedPlatforms, ['audioOS']);
});

test('rejects duplicate identities rather than overwriting evidence', () => {
  assert.throws(() => normalizeAppleCatalog(catalog([a('27.2.1'), a('27.2.1')])), /duplicate_release_id/);
});
