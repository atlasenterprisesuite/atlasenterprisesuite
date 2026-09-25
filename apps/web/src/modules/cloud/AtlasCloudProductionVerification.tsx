import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CloudSubnav } from './AtlasCloudNextLevel';

const OBSERVABILITY_URL =
  'https://ggmanzcgtlrvqfoccgsh.supabase.co/functions/v1/atlas-observability';
const RELEASE_URL =
  'https://ggmanzcgtlrvqfoccgsh.supabase.co/functions/v1/atlas-release-control';

type VerificationEvidence = { status?: string; created_at?: string };
type ObservabilityPayload = {
  ok: boolean;
  observability?: {
    posture?: string;
    latest_verifications?: Record<string, VerificationEvidence>;
    checkedAt?: string;
  };
};
type ReleaseRow = {
  id: string;
  channel: string;
  status: string;
  source_ref: string | null;
  updated_at: string;
  promoted_at: string | null;
};
type VerificationCard = {
  id: string;
  label: string;
  detail: string;
  required: boolean;
  aliases: string[];
};

const REQUIRED_CHECKS: VerificationCard[] = [
  { id: 'codeql', label: 'CodeQL', detail: 'GitHub security scanning', required: true, aliases: ['codeql', 'github-codeql', 'github-security-baseline'] },
  { id: 'workers-build', label: 'Cloudflare Workers Build', detail: 'Build & infrastructure', required: true, aliases: ['cloudflare-workers', 'workers-build', 'cloudflare-build'] },
  { id: 'validate-deploy', label: 'Validate Deploy Verify', detail: 'Deployment validation', required: true, aliases: ['validate-deploy-verify', 'production-route-verification', 'production-http'] },
  { id: 'build-readiness', label: 'Build Readiness', detail: 'Release readiness', required: true, aliases: ['build-readiness', 'verify-build-readiness'] },
  { id: 'local-runtime', label: 'ATLAS Local Runtime Verification', detail: 'Runtime environment', required: true, aliases: ['atlas-local-runtime-verification', 'local-runtime-verification', 'atlas-local-runtime'] },
  { id: 'global-production', label: 'Global Production Verification', detail: 'Global availability', required: true, aliases: ['global-production-verification', 'verify-production'] },
  { id: 'exact-sha', label: 'Exact-SHA Production Verification', detail: 'Integrity verification', required: true, aliases: ['exact-sha-production-verification', 'production-commit-sha', 'production_commit_sha_verified'] },
  { id: 'hubspot-live', label: 'HubSpot Live Verification', detail: 'Third-party integration', required: false, aliases: ['hubspot-live', 'hubspot', 'atlas-hubspot-live-verify'] }
];

function sessionHeaders() {
  const token = localStorage.getItem('atlas_access_token') || '';
  const orgId = localStorage.getItem('atlas_org_id') || '';
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (orgId) headers['x-atlas-org-id'] = orgId;
  return headers;
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { method: 'GET', cache: 'no-store', headers: sessionHeaders() });
  const body = await response.json().catch(() => ({ error: 'invalid_response' }));
  if (!response.ok) throw new Error(String(body?.error || `request_failed_${response.status}`));
  return body as T;
}

function normalizeStatus(status?: string) {
  const value = String(status || '').trim().toLowerCase();
  if (['passed', 'success', 'verified', 'completed', 'green'].includes(value)) return 'passed';
  if (['failed', 'failure', 'blocked', 'error', 'red'].includes(value)) return 'failed';
  if (['running', 'in_progress', 'verifying', 'pending', 'queued'].includes(value)) return 'pending';
  return 'unknown';
}

function findEvidence(evidence: Record<string, VerificationEvidence>, aliases: string[]) {
  const entries = Object.entries(evidence);
  for (const alias of aliases) {
    const normalizedAlias = alias.toLowerCase();
    const match = entries.find(([key]) => {
      const normalizedKey = key.toLowerCase();
      return normalizedKey === normalizedAlias
        || normalizedKey.includes(normalizedAlias)
        || normalizedAlias.includes(normalizedKey);
    });
    if (match) return { source: match[0], status: normalizeStatus(match[1]?.status), createdAt: match[1]?.created_at };
  }
  return null;
}

function sourceSha(value?: string | null) {
  if (!value) return 'Not recorded';
  const match = value.match(/\b[a-f0-9]{40}\b/i);
  return match ? match[0] : value;
}

export function AtlasCloudProductionVerification() {
  const [observability, setObservability] = useState<ObservabilityPayload | null>(null);
  const [releases, setReleases] = useState<ReleaseRow[] | null>(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    setRefreshing(true);
    setError('');
    try {
      const [observabilityResponse, releaseResponse] = await Promise.all([
        getJson<ObservabilityPayload>(`${OBSERVABILITY_URL}?api=cloud-observability`),
        getJson<{ ok: boolean; releases: ReleaseRow[] }>(`${RELEASE_URL}?api=releases`)
      ]);
      setObservability(observabilityResponse);
      setReleases(releaseResponse.releases || []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'production_verification_unavailable');
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const latestProductionRelease = useMemo(() => [...(releases || [])]
    .filter((release) => release.channel === 'production')
    .sort((a, b) => new Date(b.promoted_at || b.updated_at).getTime() - new Date(a.promoted_at || a.updated_at).getTime())[0] || null, [releases]);

  const evidence = observability?.observability?.latest_verifications || {};
  const checks = useMemo(() => REQUIRED_CHECKS.map((card) => {
    const resolved = findEvidence(evidence, card.aliases);
    return { ...card, state: resolved?.status || 'unknown', source: resolved?.source || 'Evidence not visible', createdAt: resolved?.createdAt };
  }), [evidence]);

  const requiredChecks = checks.filter((check) => check.required);
  const anyRequiredFailed = requiredChecks.some((check) => check.state === 'failed');
  const allRequiredPassed = requiredChecks.length > 0 && requiredChecks.every((check) => check.state === 'passed');
  const badge = anyRequiredFailed ? 'NOT PRODUCTION VERIFIED' : allRequiredPassed ? 'FINAL PRODUCTION VERIFIED — FULL' : 'VERIFICATION HOLD';
  const badgeTone = anyRequiredFailed ? 'failed' : allRequiredPassed ? 'passed' : 'pending';

  return (
    <section className="atlas-cloud-page atlas-cloud-control-page atlas-production-verification">
      <CloudSubnav />
      <header className="atlas-production-hero">
        <div>
          <p className="eyebrow">ATLAS Enterprise Suite · Production Integrity</p>
          <h1>ATLAS Security & Production Verification</h1>
          <p>Live evidence derived from ATLAS Observability and Release Control. Green is shown only when every mandatory check is visible and passed.</p>
        </div>
        <div className={`atlas-production-badge ${badgeTone}`}>
          <span>Production status</span><strong>{badge}</strong>
          <small>{observability?.observability?.posture || 'control-plane posture unavailable'}</small>
        </div>
      </header>

      {error ? <div className="atlas-cloud-state error" role="alert"><strong>Production verification unavailable</strong><span>{error}</span></div> : null}

      <section className="atlas-production-release-card">
        <div><span>Repository / project</span><strong>atlasenterprisesuite/atlasenterprisesuite</strong></div>
        <div><span>Current production source</span><code>{sourceSha(latestProductionRelease?.source_ref)}</code></div>
        <div><span>Release state</span><strong>{latestProductionRelease?.status || 'Not visible'}</strong></div>
        <div><span>Evidence checked</span><strong>{observability?.observability?.checkedAt || 'Not available'}</strong></div>
      </section>

      <section className="atlas-production-check-grid" aria-label="Production verification gates">
        {checks.map((check) => (
          <article key={check.id} className={`atlas-production-check ${check.state}`}>
            <div className="atlas-production-check-icon" aria-hidden="true">{check.state === 'passed' ? '✓' : check.state === 'failed' ? '×' : '•'}</div>
            <div>
              <span>{check.required ? 'Mandatory gate' : 'External / optional evidence'}</span>
              <strong>{check.label}</strong><p>{check.detail}</p>
              <small>{check.source}{check.createdAt ? ` · ${check.createdAt}` : ''}</small>
            </div>
            <b>{check.state === 'passed' ? 'Passed' : check.state === 'failed' ? 'Failed' : 'Evidence needed'}</b>
          </article>
        ))}
      </section>

      <section className="atlas-production-advisory">
        <div aria-hidden="true">!</div>
        <div><strong>External checks remain separate from ATLAS-owned production integrity.</strong><p>GitHub AI Scan or another managed-provider check does not become a green ATLAS gate merely because the provider reports success. Provider-specific evidence remains informational unless the production contract marks it mandatory.</p></div>
        <span>Fail-closed truth</span>
      </section>

      <div className="atlas-cloud-action-row">
        <button type="button" onClick={() => void load()} disabled={refreshing}>{refreshing ? 'Refreshing…' : 'Refresh production evidence'}</button>
        <Link to="/cloud/observability">Open Observability</Link><Link to="/cloud/releases">Open Release Center</Link><Link to="/execution/manager/readiness">Open Manager Readiness</Link>
      </div>
      <p className="atlas-cloud-truth-note">The approved visual design is the presentation specification only; status values are never hard-coded from the image. Production truth must come from machine-verifiable evidence.</p>
    </section>
  );
}
