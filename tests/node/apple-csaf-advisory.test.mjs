import test from 'node:test';
import assert from 'node:assert/strict';
import {
  appleAdvisoryUrl, normalizeAppleCsaf, compareAppleCsaf, inspectAppleCsaf
} from '../../packages/security/src/appleCsafAdvisory.mjs';

const product1 = 'APPLE-ios-27_2_1', product2 = 'APPLE-ipados-27_2_1';
const makeVuln = (cve, fixed = [product1, product2]) => ({
  cve, title: 'App Intents',
  product_status: { fixed },
  notes: [{ category: 'summary', title: 'Impact', text: 'An app may be able to access user data' }]
});
function fixture(vulnerabilities = [makeVuln('CVE-2026-113963')]) {
  return {
    $schema: 'https://docs.oasis-open.org/csaf/csaf/v2.1/schema/csaf.json',
    document: {
      category: 'csaf_security_advisory', csaf_version: '2.1',
      title: 'About the security content of iOS 27.2.1 and iPadOS 27.2.1',
      publisher: { name: 'Apple Product Security', namespace: 'https://security.apple.com' },
      tracking: {
        id: 'APPLE-SA-149715', status: 'final',
        initial_release_date: '2026-11-09T00:00:00Z',
        current_release_date: '2026-11-09T00:00:00Z'
      },
      references: [{ category: 'self', url: 'https://support.apple.com/en-us/149715' }],
      aggregate_severity: { text: 'Medium' }
    },
    product_tree: {
      branches: [{
        category: 'vendor', name: 'Apple',
        branches: [{ category: 'product_family', name: 'iOS and iPadOS',
          branches: [
            { category: 'product_version', name: '27.2.1', product: { name: 'iOS 27.2.1', product_id: product1 } },
            { category: 'product_version', name: '27.2.1', product: { name: 'iPadOS 27.2.1', product_id: product2 } }
          ]
        }]
      }]
    },
    vulnerabilities
  };
}
const fakeFetch = (payload, status = 200) => async (url, init) => {
  assert.equal(url, appleAdvisoryUrl('149715'));
  assert.equal(init.method, 'GET');
  assert.equal(init.redirect, 'error');
  return new Response(typeof payload === 'string' ? payload : JSON.stringify(payload), { status });
};

test('restricts advisory requests to known-format numeric Apple Support identifiers', () => {
  assert.equal(appleAdvisoryUrl('149715'), 'https://support.apple.com/content/dam/edam/applecare/images/en_US/otherassets/security/149715.json');
  for (const bad of ['../../../passwd', 'https://evil.example', '0', '', '149715.json', 149715]) {
    assert.throws(() => appleAdvisoryUrl(bad), /invalid_advisory_id/);
  }
});

test('valid official-format CSAF can create a baseline, without claiming device exposure', async () => {
  const output = await inspectAppleCsaf({ advisoryId: '149715', fetchImpl: fakeFetch(fixture()) });
  assert.equal(output.report.baselineCreated, true);
  assert.equal(output.report.changeCount, 0);
  assert.equal(output.report.cveCount, 1);
  assert.equal(output.report.cves[0].cve, 'CVE-2026-113963');
  assert.deepEqual(output.report.cves[0].fixedProducts.map(x => x.productName), ['iOS 27.2.1', 'iPadOS 27.2.1']);
  assert.equal(output.report.cves[0].deviceExposureVerified, false);
  assert.equal(output.report.productionVerified, false);
  assert.match(output.report.sourceSha256, /^[a-f0-9]{64}$/);
});

test('new Apple-published CVE creates only a review-only change', async () => {
  const previous = normalizeAppleCsaf(fixture(), '149715');
  const next = normalizeAppleCsaf(fixture([
    makeVuln('CVE-2026-113963'), makeVuln('CVE-2026-113970')
  ]), '149715');
  assert.deepEqual(compareAppleCsaf(previous, next).changes, [
    { cve: 'CVE-2026-113970', event: 'vendor_cve_newly_published' }
  ]);
});

test('product scope changes are flagged; device vulnerability is not inferred', () => {
  const previous = normalizeAppleCsaf(fixture(), '149715');
  const current = normalizeAppleCsaf(fixture([makeVuln('CVE-2026-113963', [product1])]), '149715');
  const comparison = compareAppleCsaf(previous, current);
  assert.equal(comparison.changes[0].event, 'vendor_cve_record_changed');
  assert.equal(current.deviceExposureVerified, false);
});

test('rejects duplicated, malformed, and unverifiable CVE entries', () => {
  assert.throws(() => normalizeAppleCsaf(fixture([
    makeVuln('CVE-2026-113963'), makeVuln('CVE-2026-113963')
  ]), '149715'), /invalid_or_duplicate_cve/);
  assert.throws(() => normalizeAppleCsaf(fixture([makeVuln('not-a-cve')]), '149715'), /invalid_or_duplicate_cve/);
  assert.throws(() => normalizeAppleCsaf(fixture([makeVuln('CVE-2026-113963', ['APPLE-unknown-9'])]), '149715'), /unverifiable_fixed_products/);
});

test('rejects CSAF from a different vendor, advisory ID or article URL', () => {
  const wrongVendor = fixture(); wrongVendor.document.publisher.namespace = 'https://untrusted.example';
  assert.throws(() => normalizeAppleCsaf(wrongVendor, '149715'), /vendor_identity_mismatch/);
  assert.throws(() => normalizeAppleCsaf(fixture(), '149716'), /vendor_identity_mismatch/);
  const missing = fixture(); missing.document.references = [];
  assert.throws(() => normalizeAppleCsaf(missing, '149715'), /missing_official_reference/);
});

test('detects malformed product trees and untrusted previous state', () => {
  const broken = fixture(); broken.product_tree.branches = [];
  assert.throws(() => normalizeAppleCsaf(broken, '149715'), /empty_product_tree/);
  const current = normalizeAppleCsaf(fixture(), '149715');
  assert.throws(() => compareAppleCsaf({ ...current, advisoryId: '149716' }, current), /untrusted_previous_state/);
});

test('HTTP errors, redirects and invalid JSON must fail closed', async () => {
  await assert.rejects(inspectAppleCsaf({
    advisoryId: '149715', fetchImpl: fakeFetch('{}', 502)
  }), /http_or_redirect_failure/);
  await assert.rejects(inspectAppleCsaf({
    advisoryId: '149715', fetchImpl: fakeFetch('not-json')
  }), /invalid_json/);
  await assert.rejects(inspectAppleCsaf({
    advisoryId: '149715', fetchImpl: async () => new Response('{}', { status: 200, headers: { 'content-length': '5000000' } })
  }), /response_too_large/);
});

test('zero published CVEs never means zero security risk', () => {
  const parsed = normalizeAppleCsaf(fixture([]), '149715');
  assert.equal(parsed.noPublishedCveEntries, true);
  assert.equal(parsed.deviceExposureVerified, false);
  assert.equal(parsed.vulnerabilities.length, 0);
});
