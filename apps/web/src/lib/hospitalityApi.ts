import { getActiveAtlasOrganization, getAtlasAccessToken } from './atlasSession';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://ggmanzcgtlrvqfoccgsh.supabase.co';
const PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_wicVjdsduxa5FAnRW9k0Lw_HxtBW72d';

export type HospitalityPermission =
  | 'hospitality.access.read'
  | 'hospitality.access.issue'
  | 'hospitality.access.revoke'
  | 'hospitality.access.configure'
  | 'hospitality.access.audit'
  | 'hospitality.access.admin';

export type HospitalityProviderState =
  | 'not_configured'
  | 'configured_unverified'
  | 'ready'
  | 'degraded'
  | 'offline'
  | 'disabled';

export type HospitalityProvider = {
  id: string;
  property_id: string;
  provider_type: string;
  display_name: string;
  state: HospitalityProviderState;
  blocker?: string | null;
  capabilities: string[];
  provider_property_id?: string | null;
  last_verified_at?: string | null;
  checked_at?: string | null;
};

export type HospitalityReadiness = {
  ok: boolean;
  service: string;
  version: number;
  organization_id: string;
  role: string;
  permissions: HospitalityPermission[];
  providers: HospitalityProvider[];
  issuance_enabled: boolean;
  checked_at: string;
};

export type HospitalityRoom = {
  id: string;
  org_id: string;
  property_id: string;
  provider_instance_id: string;
  atlas_room_id: string;
  provider_room_id: string;
  provider_lock_id: string | null;
  status: 'pending' | 'verified' | 'invalid' | 'disabled';
  last_verified_at: string | null;
};

export type HospitalityCredential = {
  id: string;
  org_id?: string;
  property_id?: string;
  room_id?: string;
  provider_instance_id?: string;
  provider_credential_id: string;
  assignment_reference?: string;
  credential_type?: string;
  starts_at?: string;
  expires_at?: string;
  status?: 'issued' | 'revoked' | 'expired' | 'failed' | 'unknown';
  state?: 'issued' | 'revoked' | 'expired' | 'failed' | 'unknown';
  issued_by?: string;
  issued_at?: string;
  revoked_at?: string | null;
  provider_status_code?: number | null;
};

export type HospitalityAuditRow = {
  id: number | string;
  user_id: string | null;
  action: string;
  record_id: string | null;
  new_data: Record<string, unknown> | null;
  created_at: string;
};

export type IssueHospitalityCredentialInput = {
  property_id: string;
  provider_instance_id: string;
  room_id: string;
  assignment_reference: string;
  starts_at: string;
  expires_at: string;
  reason: 'guest_checkin' | 'replacement' | 'staff_authorized';
};

function query(params: Record<string, string | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  return search.toString();
}

async function parseResponse(response: Response) {
  const data = await response.json().catch(() => ({ error: 'invalid_response' }));
  if (!response.ok) {
    const error = Object.assign(new Error(String(data?.error || `request_failed_${response.status}`)), {
      status: response.status,
      data
    });
    throw error;
  }
  return data;
}

async function requestWithToken(url: string, init: RequestInit, token: string) {
  return fetch(url, {
    ...init,
    headers: {
      apikey: PUBLISHABLE_KEY,
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      ...(init.headers || {})
    }
  });
}

export async function hospitalityRequest<T>(
  api: string,
  params: Record<string, string | undefined> = {},
  init: RequestInit = {}
): Promise<T> {
  let token = getAtlasAccessToken();
  if (!token) throw new Error('authentication_required');

  const suffix = query({ api, ...params });
  const url = `${SUPABASE_URL}/functions/v1/atlas-hospitality-access?${suffix}`;
  let response = await requestWithToken(url, init, token);

  if (response.status === 401) {
    await getActiveAtlasOrganization();
    token = getAtlasAccessToken();
    if (!token) throw new Error('session_expired');
    response = await requestWithToken(url, init, token);
  }

  return parseResponse(response) as Promise<T>;
}

export function getHospitalityReadiness(propertyId?: string) {
  return hospitalityRequest<HospitalityReadiness>('readiness', { property_id: propertyId });
}

export async function listHospitalityProviders(propertyId?: string) {
  const data = await hospitalityRequest<{ ok: boolean; providers: HospitalityProvider[] }>('providers', {
    property_id: propertyId
  });
  return data.providers;
}

export async function listHospitalityRooms(propertyId: string) {
  const data = await hospitalityRequest<{ ok: boolean; rooms: HospitalityRoom[] }>('rooms', {
    property_id: propertyId
  });
  return data.rooms;
}

export async function listHospitalityCredentials(propertyId: string) {
  const data = await hospitalityRequest<{ ok: boolean; credentials: HospitalityCredential[] }>('credentials', {
    property_id: propertyId
  });
  return data.credentials;
}

export async function issueHospitalityCredential(input: IssueHospitalityCredentialInput) {
  const data = await hospitalityRequest<{ ok: boolean; credential: HospitalityCredential }>('issue', {}, {
    method: 'POST',
    body: JSON.stringify(input)
  });
  return data.credential;
}

export async function revokeHospitalityCredential(input: {
  property_id: string;
  credential_id: string;
  reason?: string;
}) {
  const data = await hospitalityRequest<{ ok: boolean; credential: HospitalityCredential }>('revoke', {}, {
    method: 'POST',
    body: JSON.stringify(input)
  });
  return data.credential;
}

export async function getHospitalityCredentialStatus(propertyId: string, credentialId: string) {
  const data = await hospitalityRequest<{
    ok: boolean;
    credential: HospitalityCredential;
    source: 'provider' | 'atlas_reference';
  }>('credential-status', { property_id: propertyId, credential_id: credentialId });
  return data;
}

export async function getHospitalityAudit(propertyId: string) {
  const data = await hospitalityRequest<{ ok: boolean; audit: HospitalityAuditRow[] }>('audit', {
    property_id: propertyId
  });
  return data.audit;
}

export function hasHospitalityPermission(
  permissions: readonly HospitalityPermission[],
  permission: HospitalityPermission
) {
  return permissions.includes('hospitality.access.admin') || permissions.includes(permission);
}
