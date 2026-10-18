import { authorizedAtlasFetch, getActiveAtlasOrganization } from './atlasSession';

export type MailProvisioningReadiness = {
  ok: boolean;
  service: 'atlas-mail-provisioning';
  organization_id: string;
  state: 'pending_provider' | 'configured_unverified' | 'ready' | 'degraded';
  blocker: string | null;
  provider: 'cloudflare' | null;
  provider_verified: boolean;
  provisioning_enabled: boolean;
  domain: string;
  destination_configured: boolean;
  destination_verified: boolean;
  secret_values_returned: false;
  checked_at: string;
};

export type MailAliasResult = {
  address: string;
  status: 'created' | 'existing' | 'failed';
  error?: string;
};

async function request<T>(api: string, init: RequestInit = {}): Promise<T> {
  const organization = await getActiveAtlasOrganization();
  const response = await authorizedAtlasFetch(
    `/functions/v1/atlas-mail-provisioning?api=${encodeURIComponent(api)}`,
    {
      ...init,
      headers: {
        'content-type': 'application/json',
        'x-atlas-org-id': organization.id,
        ...(init.headers || {})
      }
    }
  );
  const data = await response.json().catch(() => ({ error: 'invalid_response' }));
  if (!response.ok) throw new Error(String(data?.error || `request_failed_${response.status}`));
  return data as T;
}

export function getMailProvisioningReadiness() {
  return request<MailProvisioningReadiness>('readiness');
}

export function provisionMailAliases(localParts: string[]) {
  return request<{ ok: true; results: MailAliasResult[] }>('bulk-provision', {
    method: 'POST',
    body: JSON.stringify({ local_parts: localParts })
  });
}
