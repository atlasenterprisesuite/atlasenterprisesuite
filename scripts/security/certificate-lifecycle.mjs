import { X509Certificate } from 'node:crypto';

const DAY_MS = 86_400_000;
const HEX_SHA256 = /^[a-f0-9]{64}$/;
const STATES = new Set(['active', 'revoked', 'pending_revocation', 'pending_reactivation']);
const statusRank = { ready: 0, warning: 1, blocked: 2 };

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}
function asDate(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const d = new Date(value);
  return Number.isFinite(d.getTime()) ? d : null;
}
function digest(value) {
  return String(value || '').replace(/:/g, '').toLowerCase();
}
function classify(certificate, nowMs, renewDays, criticalDays) {
  const expiry = asDate(certificate.expires_on);
  if (!expiry) return 'invalid_expiry';
  const remaining = (expiry.getTime() - nowMs) / DAY_MS;
  if (remaining <= 0) return 'expired';
  if (remaining <= criticalDays) return 'critical_renewal';
  if (remaining <= renewDays) return 'renewal_due';
  return 'current';
}

/**
 * Read-only evaluation of Cloudflare zone mTLS certificates. Never emits raw
 * certificates, CSRs, certificate IDs, fingerprints, or private keys.
 *
 * Live provider state remains authoritative; an expected hostname association
 * and complete pagination are mandatory for a ready verdict.
 */
export function evaluateClientCertificateInventory(
  { pages, hostnameAssociations },
  { now = new Date(), hostname = 'www.atlasenterprisesuite.com', renewDays = 30, criticalDays = 7 } = {},
) {
  const time = new Date(now);
  if (!Number.isFinite(time.getTime()) || !Number.isInteger(renewDays) || !Number.isInteger(criticalDays) ||
      criticalDays <= 0 || renewDays <= criticalDays) fail('invalid_audit_options');
  if (!Array.isArray(pages) || pages.length === 0 || pages.length > 100) fail('inventory_incomplete');
  const first = pages[0];
  const totalPages = first?.result_info?.total_pages;
  const totalCount = first?.result_info?.total_count;
  if (!Number.isSafeInteger(totalPages) || totalPages < 1 || totalPages > 100 ||
      !Number.isSafeInteger(totalCount) || totalCount < 0 || pages.length !== totalPages) fail('inventory_incomplete');

  const findings = [];
  const counts = {
    total: 0, active: 0, revoked: 0, pending: 0,
    expiring: 0, critical: 0, expired: 0, invalid: 0, unverified_pem: 0,
  };
  let status = 'ready';
  const raise = (severity, code) => {
    findings.push({ severity, code });
    if (statusRank[severity] > statusRank[status]) status = severity;
  };

  if (hostnameAssociations?.success !== true ||
      !Array.isArray(hostnameAssociations?.result?.hostnames) ||
      !hostnameAssociations.result.hostnames.includes(hostname)) {
    raise('blocked', 'mtls_hostname_association_missing');
  }
  const ids = new Set();
  const fingerprints = new Set();
  for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
    const page = pages[pageIndex];
    const info = page?.result_info;
    if (page?.success !== true || !Array.isArray(page.result) ||
        info?.page !== pageIndex + 1 || info?.total_pages !== totalPages ||
        info?.total_count !== totalCount || page.result.length > 50) fail('inventory_incomplete');
    for (const cert of page.result) {
      counts.total++;
      const id = String(cert?.id || '');
      if (!/^[a-zA-Z0-9-]{12,80}$/.test(id) || ids.has(id)) {
        counts.invalid++;
        raise('blocked', 'invalid_or_duplicate_certificate_identity');
        continue;
      }
      ids.add(id);
      if (!STATES.has(cert.status)) {
        counts.invalid++;
        raise('blocked', 'unknown_certificate_status');
        continue;
      }
      if (cert.status === 'revoked') { counts.revoked++; continue; }
      if (cert.status !== 'active') {
        counts.pending++;
        raise('warning', 'certificate_transition_pending');
        continue;
      }
      counts.active++;
      const state = classify(cert, time.getTime(), renewDays, criticalDays);
      if (state === 'invalid_expiry') {
        counts.invalid++;
        raise('blocked', 'certificate_expiry_invalid');
      } else if (state === 'expired') {
        counts.expired++;
        raise('blocked', 'certificate_expired');
      } else if (state === 'critical_renewal') {
        counts.critical++;
        raise('blocked', 'certificate_renewal_critical');
      } else if (state === 'renewal_due') {
        counts.expiring++;
        raise('warning', 'certificate_renewal_due');
      }
      const fp = digest(cert.fingerprint_sha256);
      if (!HEX_SHA256.test(fp) || fingerprints.has(fp)) {
        counts.invalid++;
        raise('blocked', 'certificate_fingerprint_invalid_or_duplicate');
      } else {
        fingerprints.add(fp);
      }
      if (typeof cert.certificate === 'string' && cert.certificate.trim()) {
        try {
          const x509 = new X509Certificate(cert.certificate);
          if (digest(x509.fingerprint256) !== fp ||
              Math.abs(new Date(x509.validTo).getTime() - new Date(cert.expires_on).getTime()) > 60_000 ||
              !asDate(x509.validFrom) || !asDate(x509.validTo)) {
            counts.invalid++;
            raise('blocked', 'certificate_metadata_mismatch');
          }
        } catch {
          counts.invalid++;
          raise('blocked', 'certificate_pem_invalid');
        }
      } else {
        counts.unverified_pem++;
        raise('warning', 'certificate_pem_missing');
      }
    }
  }
  if (counts.total !== totalCount) fail('inventory_incomplete');
  if (counts.active === 0) raise('warning', 'no_active_client_certificates');
  return Object.freeze({
    status,
    checked_at: time.toISOString(),
    provider: 'cloudflare',
    policy: { renewal_days: renewDays, critical_days: criticalDays, auto_issue_without_device_csr: false },
    counts,
    findings,
    reconciliation: 'provider_only_unverified_against_atlas_agent_bindings',
    next_action: status === 'blocked' ? 'security_review_required' :
      counts.critical + counts.expiring > 0 ? 'request_device_generated_csr' : 'no_renewal_action',
  });
}
