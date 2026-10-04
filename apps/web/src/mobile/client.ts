import { authorizedAtlasFetch, getActiveAtlasOrganization } from '../lib/atlasSession';

export type MobileGatewayEvidenceState = {
  state: string;
  last_verified_at: string | null;
  source?: string;
};

export type MobileStatusResponse = {
  ok: true;
  authenticated: true;
  organization_id: string;
  role: string;
  runtime_policy: Record<string, MobileGatewayEvidenceState>;
  feature_states: Record<string, MobileGatewayEvidenceState>;
};

export type MobileAuditEvent = {
  event_type: string;
  metadata?: Record<string, unknown>;
};

function unverifiedEvidence(): MobileGatewayEvidenceState {
  return { state: 'unverified', last_verified_at: null };
}

export function createUnverifiedMobileStatus(organizationId = '', role = 'unknown'): MobileStatusResponse {
  return {
    ok: true,
    authenticated: true,
    organization_id: organizationId,
    role,
    runtime_policy: {
      browser: unverifiedEvidence(),
      native_bridge: { state: 'unsupported_runtime', last_verified_at: null }
    },
    feature_states: {
      permissions: unverifiedEvidence(),
      billing: unverifiedEvidence(),
      diagnostics: unverifiedEvidence(),
      audit: unverifiedEvidence(),
      native_bridge: { state: 'unsupported_runtime', last_verified_at: null }
    }
  };
}

async function parseJson(response: Response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return {};
  }
}

function validEvidenceMap(value: unknown): value is Record<string, MobileGatewayEvidenceState> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.values(value as Record<string, unknown>).every((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return false;
    const state = (entry as Record<string, unknown>).state;
    const verifiedAt = (entry as Record<string, unknown>).last_verified_at;
    return typeof state === 'string' && (verifiedAt === null || typeof verifiedAt === 'string');
  });
}

export async function getMobileStatus(): Promise<MobileStatusResponse> {
  const organization = await getActiveAtlasOrganization();
  const response = await authorizedAtlasFetch('/functions/v1/atlas-mobile?api=status', {
    method: 'GET',
    headers: { 'x-atlas-org-id': organization.id }
  });
  const payload = await parseJson(response);

  if (!response.ok) throw new Error(String(payload?.error || `mobile_status_failed_${response.status}`));
  if (
    payload?.ok !== true
    || payload?.authenticated !== true
    || payload?.organization_id !== organization.id
    || typeof payload?.role !== 'string'
    || !validEvidenceMap(payload?.runtime_policy)
    || !validEvidenceMap(payload?.feature_states)
  ) {
    throw new Error('mobile_status_invalid_response');
  }

  return payload as MobileStatusResponse;
}

export async function postMobileAudit(event: MobileAuditEvent) {
  const organization = await getActiveAtlasOrganization();
  const response = await authorizedAtlasFetch('/functions/v1/atlas-mobile?api=audit', {
    method: 'POST',
    headers: { 'x-atlas-org-id': organization.id },
    body: JSON.stringify(event)
  });
  const payload = await parseJson(response);
  if (!response.ok || payload?.ok !== true || payload?.accepted !== true) {
    throw new Error(String(payload?.error || `mobile_audit_failed_${response.status}`));
  }
  return payload as { ok: true; accepted: true; event_type: string };
}
