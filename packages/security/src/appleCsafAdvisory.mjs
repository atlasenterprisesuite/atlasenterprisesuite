/**
 * ATLAS Security Radar 777 — Apple CSAF 2.1 security-advisory adapter.
 * Fetches only a numeric Apple Support advisory ID from a fixed vendor URL.
 * Read-only, evidence-first, no device targeting or automated remediation.
 */
import { createHash } from 'node:crypto';

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const plainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const CVE_PATTERN = /^CVE-(?:19|20)\d{2}-[1-9]\d{3,}$/;
const MAX_RESPONSE_BYTES = 3_000_000;
const MAX_TREE_NODES = 15_000;
const MAX_VULNERABILITIES = 2_000;

export function appleAdvisoryUrl(advisoryId) {
  if (typeof advisoryId !== 'string' || !/^[1-9]\d{4,7}$/.test(advisoryId)) {
    throw new Error('apple_csaf_invalid_advisory_id');
  }
  return 'https://support.apple.com/content/dam/edam/applecare/images/en_US/otherassets/security/' +
    advisoryId + '.json';
}

export function normalizeAppleCsaf(payload, advisoryId) {
  appleAdvisoryUrl(advisoryId);
  if (!plainObject(payload) || !plainObject(payload.document) ||
      payload.document.csaf_version !== '2.1' ||
      payload.document.category !== 'csaf_security_advisory') {
    throw new Error('apple_csaf_invalid_schema');
  }
  const doc = payload.document;
  if (doc.publisher?.name !== 'Apple Product Security' ||
      doc.publisher?.namespace !== 'https://security.apple.com' ||
      doc.tracking?.id !== 'APPLE-SA-' + advisoryId ||
      doc.tracking?.status !== 'final' ||
      typeof doc.title !== 'string' || doc.title.length < 5 || doc.title.length > 500) {
    throw new Error('apple_csaf_vendor_identity_mismatch');
  }
  const articleUrl = 'https://support.apple.com/en-us/' + advisoryId;
  if (!Array.isArray(doc.references) ||
      !doc.references.some((ref) => ref?.category === 'self' && ref.url === articleUrl)) {
    throw new Error('apple_csaf_missing_official_reference');
  }
  for (const value of [doc.tracking.initial_release_date, doc.tracking.current_release_date]) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(value) ||
        !Number.isFinite(Date.parse(value))) {
      throw new Error('apple_csaf_invalid_release_date');
    }
  }
  if (!Array.isArray(payload.product_tree?.branches)) {
    throw new Error('apple_csaf_missing_product_tree');
  }
  const products = new Map();
  let nodes = 0;
  function visit(branches, depth = 0) {
    if (depth > 12) throw new Error('apple_csaf_product_tree_depth_exceeded');
    for (const branch of branches) {
      if (++nodes > MAX_TREE_NODES || !plainObject(branch)) {
        throw new Error('apple_csaf_invalid_product_tree');
      }
      if (branch.product !== undefined) {
        const p = branch.product;
        if (!plainObject(p) || typeof p.product_id !== 'string' ||
            !/^APPLE-[A-Za-z0-9_.-]{1,120}$/.test(p.product_id) ||
            typeof p.name !== 'string' || p.name.length < 2 || p.name.length > 200 ||
            products.has(p.product_id)) {
          throw new Error('apple_csaf_invalid_product');
        }
        products.set(p.product_id, p.name);
      }
      if (branch.branches !== undefined) {
        if (!Array.isArray(branch.branches)) throw new Error('apple_csaf_invalid_product_branches');
        visit(branch.branches, depth + 1);
      }
    }
  }
  visit(payload.product_tree.branches);
  if (products.size === 0) throw new Error('apple_csaf_empty_product_tree');
  if (!Array.isArray(payload.vulnerabilities) ||
      payload.vulnerabilities.length > MAX_VULNERABILITIES) {
    throw new Error('apple_csaf_invalid_vulnerabilities');
  }

  const seen = new Set();
  const vulnerabilities = payload.vulnerabilities.map((vuln) => {
    if (!plainObject(vuln) || typeof vuln.cve !== 'string' ||
        !CVE_PATTERN.test(vuln.cve) || seen.has(vuln.cve) ||
        typeof vuln.title !== 'string' || vuln.title.length > 150) {
      throw new Error('apple_csaf_invalid_or_duplicate_cve');
    }
    seen.add(vuln.cve);
    const fixed = vuln.product_status?.fixed;
    if (!Array.isArray(fixed) || fixed.length === 0 || fixed.length > 500 ||
        fixed.some((id) => !products.has(id))) {
      throw new Error('apple_csaf_unverifiable_fixed_products');
    }
    const fixedProducts = [...new Set(fixed)].sort().map((id) => ({
      productId: id, productName: products.get(id)
    }));
    const impactNote = Array.isArray(vuln.notes)
      ? vuln.notes.find((note) => note?.title === 'Impact' && note.category === 'summary')
      : undefined;
    return {
      cve: vuln.cve,
      component: vuln.title,
      impact: typeof impactNote?.text === 'string' ? impactNote.text.slice(0, 1000) : null,
      fixedProducts,
      evidenceType: 'apple_csaf_vendor_fixed',
      deviceExposureVerified: false
    };
  }).sort((a, b) => a.cve.localeCompare(b.cve));

  return {
    advisoryId,
    articleUrl,
    trackingId: doc.tracking.id,
    title: doc.title,
    status: doc.tracking.status,
    csafVersion: '2.1',
    publishedAt: doc.tracking.initial_release_date,
    revisedAt: doc.tracking.current_release_date,
    aggregateSeverity: typeof doc.aggregate_severity?.text === 'string'
      ? doc.aggregate_severity.text.slice(0, 80) : null,
    vulnerabilities,
    noPublishedCveEntries: vulnerabilities.length === 0,
    deviceExposureVerified: false,
    productionVerified: false
  };
}

export function compareAppleCsaf(previous, current) {
  if (previous == null) return { baselineCreated: true, changes: [] };
  if (previous.advisoryId !== current.advisoryId ||
      previous.trackingId !== current.trackingId ||
      !Array.isArray(previous.vulnerabilities)) {
    throw new Error('apple_csaf_untrusted_previous_state');
  }
  const old = new Map(previous.vulnerabilities.map((x) => [x.cve, x]));
  if (old.size !== previous.vulnerabilities.length ||
      [...old.keys()].some((id) => !CVE_PATTERN.test(id))) {
    throw new Error('apple_csaf_untrusted_previous_state');
  }
  const changes = [];
  for (const vuln of current.vulnerabilities) {
    const before = old.get(vuln.cve);
    if (!before) changes.push({ cve: vuln.cve, event: 'vendor_cve_newly_published' });
    else if (JSON.stringify(before) !== JSON.stringify(vuln)) {
      changes.push({ cve: vuln.cve, event: 'vendor_cve_record_changed' });
    }
  }
  for (const oldCve of old.keys()) {
    if (!current.vulnerabilities.some((x) => x.cve === oldCve)) {
      changes.push({ cve: oldCve, event: 'vendor_cve_no_longer_listed_review_required' });
    }
  }
  return { baselineCreated: false, changes, reviewOnly: true };
}

export async function inspectAppleCsaf({
  advisoryId, previousState = null, fetchImpl = fetch, now = new Date()
} = {}) {
  const sourceUrl = appleAdvisoryUrl(advisoryId);
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) throw new Error('invalid_check_time');
  const response = await fetchImpl(sourceUrl, {
    method: 'GET',
    redirect: 'error',
    signal: AbortSignal.timeout(15_000),
    headers: { accept: 'application/json', 'user-agent': 'ATLAS-Security-Radar/0.2 (+https://atlasenterprisesuite.com)' }
  });
  if (!response.ok || response.redirected || (response.url && response.url !== sourceUrl)) {
    throw new Error('apple_csaf_http_or_redirect_failure');
  }
  const claimedLength = Number(response.headers.get('content-length') ?? 0);
  if (claimedLength > MAX_RESPONSE_BYTES) throw new Error('apple_csaf_response_too_large');
  const raw = await response.text();
  if (Buffer.byteLength(raw, 'utf8') > MAX_RESPONSE_BYTES) throw new Error('apple_csaf_response_too_large');
  let data;
  try { data = JSON.parse(raw); } catch { throw new Error('apple_csaf_invalid_json'); }
  const normalized = normalizeAppleCsaf(data, advisoryId);
  const { baselineCreated, changes } = compareAppleCsaf(previousState, normalized);
  return {
    nextState: normalized,
    report: {
      sourceUrl,
      sourceSha256: sha256(raw),
      normalizedSha256: sha256(JSON.stringify(normalized)),
      checkedAt: now.toISOString(),
      trackingId: normalized.trackingId,
      publishedAt: normalized.publishedAt,
      revisedAt: normalized.revisedAt,
      cveCount: normalized.vulnerabilities.length,
      cves: normalized.vulnerabilities,
      baselineCreated,
      changeCount: changes.length,
      changes,
      reviewOnly: true,
      sourceRetrievalVerified: true,
      deviceExposureVerified: false,
      productionVerified: false
    }
  };
}
