/**
 * ATLAS Security Radar 777 — official Apple Software Lookup Service adapter.
 * Read-only. The catalog describes releases, NOT CVEs or exploitation.
 * Do not treat release observations as device compliance or production proof.
 */
import { createHash } from 'node:crypto';

export const APPLE_SOFTWARE_LOOKUP_URL = 'https://gdmf.apple.com/v2/pmv';
export const APPLE_SECURITY_RELEASES_URL = 'https://support.apple.com/en-us/100100';
const ALLOWED_PLATFORMS = ['iOS', 'macOS', 'visionOS'];
const MAX_RESPONSE_BYTES = 15_000_000;
const MAX_RELEASES_PER_PLATFORM = 10_000;
const MAX_SUPPORTED_DEVICES = 10_000;

const sha256 = (text) => createHash('sha256').update(text).digest('hex');
const plainObject = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);

function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T00:00:00.000Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function normalizeRelease(entry, platform) {
  if (!plainObject(entry)) throw new Error('apple_catalog_invalid_release');
  const version = entry.ProductVersion;
  const build = entry.Build ?? null;
  if (typeof version !== 'string' || !/^[0-9][0-9A-Za-z.() -]{0,39}$/.test(version)) {
    throw new Error('apple_catalog_invalid_version');
  }
  if (build !== null && (typeof build !== 'string' || !/^[0-9A-Za-z.-]{1,40}$/.test(build))) {
    throw new Error('apple_catalog_invalid_build');
  }
  if (!validDate(entry.PostingDate) ||
      (entry.ExpirationDate != null && !validDate(entry.ExpirationDate))) {
    throw new Error('apple_catalog_invalid_date');
  }
  if (!Array.isArray(entry.SupportedDevices) ||
      entry.SupportedDevices.length === 0 ||
      entry.SupportedDevices.length > MAX_SUPPORTED_DEVICES ||
      entry.SupportedDevices.some((device) =>
        typeof device !== 'string' || !/^[A-Za-z0-9,._-]{1,100}$/.test(device))) {
    throw new Error('apple_catalog_invalid_device_list');
  }
  const devices = [...new Set(entry.SupportedDevices)].sort();
  return {
    id: [platform, version, build ?? 'unspecified', entry.PostingDate].join('|'),
    platform, version, build,
    postedAt: entry.PostingDate,
    expiresAt: entry.ExpirationDate ?? null,
    supportedDeviceCount: devices.length,
    supportedDevicesSha256: sha256(JSON.stringify(devices))
  };
}

/**
 * Only PublicAssetSets are included. Managed AssetSets and Background Security
 * Improvements must be examined separately: their presence does not imply
 * availability to a personal device or an associated published CVE.
 */
export function normalizeAppleCatalog(payload) {
  if (!plainObject(payload) || !plainObject(payload.PublicAssetSets)) {
    throw new Error('apple_catalog_missing_public_assets');
  }
  const releases = [];
  for (const platform of ALLOWED_PLATFORMS) {
    const entries = payload.PublicAssetSets[platform];
    if (entries === undefined) continue;
    if (!Array.isArray(entries) || entries.length > MAX_RELEASES_PER_PLATFORM) {
      throw new Error('apple_catalog_invalid_platform_assets');
    }
    for (const entry of entries) releases.push(normalizeRelease(entry, platform));
  }
  if (releases.length === 0) throw new Error('apple_catalog_empty_or_unrecognized');
  releases.sort((a, b) => a.id.localeCompare(b.id));
  const ids = new Set();
  for (const release of releases) {
    if (ids.has(release.id)) throw new Error('apple_catalog_duplicate_release_id');
    ids.add(release.id);
  }
  return {
    releases,
    unreviewedPlatforms: Object.keys(payload.PublicAssetSets)
      .filter((name) => !ALLOWED_PLATFORMS.includes(name)).sort()
  };
}

export function compareAppleCatalog(previousState, nextState) {
  if (previousState == null) return { baselineCreated: true, changes: [] };
  if (previousState.schemaVersion !== 1 ||
      previousState.sourceUrl !== APPLE_SOFTWARE_LOOKUP_URL ||
      !Array.isArray(previousState.releases) ||
      previousState.releases.some((x) => !plainObject(x) || typeof x.id !== 'string')) {
    throw new Error('apple_catalog_previous_state_untrusted');
  }
  const old = new Map(previousState.releases.map((x) => [x.id, x]));
  const changes = [];
  for (const release of nextState.releases) {
    const before = old.get(release.id);
    const changed = before && JSON.stringify(before) !== JSON.stringify(release);
    if (!before || changed) {
      changes.push({
        type: before ? 'release_metadata_changed' : 'release_observed',
        release,
        evidence: 'official_apple_public_asset_catalog',
        cveStatus: 'not_evaluated',
        assessment: 'manual_review_required',
        automatedRemediation: false
      });
    }
  }
  return { baselineCreated: false, changes };
}

export async function inspectAppleSoftwareReleases({
  previousState = null, fetchImpl = fetch, now = new Date()
} = {}) {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) throw new Error('invalid_check_time');
  const response = await fetchImpl(APPLE_SOFTWARE_LOOKUP_URL, {
    method: 'GET', redirect: 'error',
    signal: AbortSignal.timeout(15_000),
    headers: { accept: 'application/json', 'user-agent': 'ATLAS-Security-Radar/0.1 (+https://atlasenterprisesuite.com)' }
  });
  if (!response.ok || response.redirected ||
      (response.url && response.url !== APPLE_SOFTWARE_LOOKUP_URL)) {
    throw new Error('apple_catalog_http_or_redirect_failure');
  }
  const claimedLength = Number(response.headers.get('content-length') ?? 0);
  if (claimedLength > MAX_RESPONSE_BYTES) throw new Error('apple_catalog_too_large');
  const raw = await response.text();
  if (Buffer.byteLength(raw, 'utf8') > MAX_RESPONSE_BYTES) throw new Error('apple_catalog_too_large');
  let parsed;
  try { parsed = JSON.parse(raw); } catch { throw new Error('apple_catalog_invalid_json'); }
  const { releases, unreviewedPlatforms } = normalizeAppleCatalog(parsed);
  const checkedAt = now.toISOString();
  const nextState = {
    schemaVersion: 1,
    sourceUrl: APPLE_SOFTWARE_LOOKUP_URL,
    advisoryUrl: APPLE_SECURITY_RELEASES_URL,
    checkedAt,
    rawResponseSha256: sha256(raw),
    normalizedReleasesSha256: sha256(JSON.stringify(releases)),
    releases,
    unreviewedPlatforms
  };
  const { baselineCreated, changes } = compareAppleCatalog(previousState, nextState);
  return {
    nextState,
    result: {
      checkedAt, sourceUrl: APPLE_SOFTWARE_LOOKUP_URL,
      baselineCreated, releaseCount: releases.length,
      changeCount: changes.length, changes, unreviewedPlatforms,
      verifiedSourceRetrieval: true,
      cveCorrelationVerified: false,
      deviceComplianceVerified: false,
      productionVerified: false
    }
  };
}
