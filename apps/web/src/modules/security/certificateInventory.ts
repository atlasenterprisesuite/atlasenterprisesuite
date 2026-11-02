import { authorizedAtlasFetch, getActiveAtlasOrganization } from '../../lib/atlasSession';

export type CertificateTarget = {
  id: string;
  org_id: string;
  label: string;
  hostname: string;
  port: number;
  provider: string;
  environment: string;
  purpose: string;
  monitoring_approved: boolean;
  created_at: string;
};

export type CertificateObservation = {
  id: string;
  org_id: string;
  target_id: string;
  observed_at: string;
  observation_status: 'verified_tls' | 'tls_failure' | 'unknown';
  source: 'github_actions_oidc' | 'approved_internal_agent';
  certificate_sha256: string | null;
  certificate_subject: string | null;
  certificate_issuer: string | null;
  not_before: string | null;
  not_after: string | null;
  tls_protocol: string | null;
  hostname_verified: boolean;
  chain_verified: boolean;
  mtls_verified: boolean;
  evidence_sha256: string;
  evidence_ref: string;
};

export type CertificateInventory = {
  source: 'supabase_authenticated_rls';
  organizationId: string;
  loadedAt: string;
  targets: CertificateTarget[];
  observations: CertificateObservation[];
};

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new Error(response.status === 403 ? 'certificate_access_denied' : 'certificate_source_unavailable');
  }
  const data: unknown = await response.json();
  if (!Array.isArray(data)) throw new Error('certificate_invalid_source');
  return data as T;
}

export async function loadCertificateInventory(): Promise<CertificateInventory> {
  const organization = await getActiveAtlasOrganization();
  const orgFilter = encodeURIComponent('eq.' + organization.id);
  const [targetsResponse, observationsResponse] = await Promise.all([
    authorizedAtlasFetch('/rest/v1/atlas_certificate_targets?org_id=' + orgFilter
      + '&select=id,org_id,label,hostname,port,provider,environment,purpose,monitoring_approved,created_at'
      + '&order=created_at.desc&limit=200', { method: 'GET', cache: 'no-store' }),
    authorizedAtlasFetch('/rest/v1/atlas_certificate_observations?org_id=' + orgFilter
      + '&select=id,org_id,target_id,observed_at,observation_status,source,certificate_sha256,certificate_subject,certificate_issuer,not_before,not_after,tls_protocol,hostname_verified,chain_verified,mtls_verified,evidence_sha256,evidence_ref'
      + '&order=observed_at.desc&limit=500', { method: 'GET', cache: 'no-store' })
  ]);
  const [targets, observations] = await Promise.all([
    readJson<CertificateTarget[]>(targetsResponse),
    readJson<CertificateObservation[]>(observationsResponse)
  ]);
  return {
    source: 'supabase_authenticated_rls',
    organizationId: organization.id,
    loadedAt: new Date().toISOString(),
    targets,
    observations
  };
}

export type CertificateVerdict = 'verified' | 'expiring_soon' | 'failed' | 'stale' | 'no_evidence';
export function certificateVerdict(
  target: CertificateTarget,
  observations: CertificateObservation[],
  now: number,
  maxAgeMs = 24 * 60 * 60 * 1000
): CertificateVerdict {
  const latest = observations
    .filter((item) => item.target_id === target.id && item.org_id === target.org_id)
    .sort((a, b) => Date.parse(b.observed_at) - Date.parse(a.observed_at))[0];
  if (!latest || !target.monitoring_approved) return 'no_evidence';
  const observedAt = Date.parse(latest.observed_at);
  if (!Number.isFinite(observedAt) || observedAt > now + 5 * 60 * 1000 || now - observedAt > maxAgeMs) return 'stale';
  if (latest.observation_status === 'tls_failure') return 'failed';
  if (latest.observation_status === 'verified_tls'
      && latest.hostname_verified && latest.chain_verified
      && (target.purpose === 'server_tls' || latest.mtls_verified)
      && Boolean(latest.certificate_sha256?.match(/^[a-f0-9]{64}$/))
      && latest.not_after && Date.parse(latest.not_after) > now) {
    return Date.parse(latest.not_after) - now <= 30 * 24 * 60 * 60 * 1000
      ? 'expiring_soon' : 'verified';
  }
  return 'no_evidence';
}
