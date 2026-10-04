import { authorizedAtlasFetch, getActiveAtlasOrganization } from './atlasSession';

export type WirelessMvnoReadinessState =
  | 'pending_provider'
  | 'configured_unverified'
  | 'ready'
  | 'degraded'
  | 'offline';

export type WirelessMvnoReadiness = {
  ok: boolean;
  service: 'atlas-wireless-mvno';
  version: number;
  organization_id: string;
  role: string;
  state: WirelessMvnoReadinessState;
  blocker: string | null;
  provider_verified: boolean;
  activation_enabled: boolean;
  capabilities: string[];
  credentials: {
    provider_id_configured: boolean;
    api_base_url_configured: boolean;
    api_token_configured: boolean;
  };
  provider_secret_values_returned: false;
  checked_at: string;
};

async function parseResponse<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => ({ error: 'invalid_response' }));
  if (!response.ok) {
    const error = Object.assign(
      new Error(String(data?.error || `request_failed_${response.status}`)),
      { status: response.status, data }
    );
    throw error;
  }
  return data as T;
}

export async function getWirelessMvnoReadiness(): Promise<WirelessMvnoReadiness> {
  const organization = await getActiveAtlasOrganization();
  const response = await authorizedAtlasFetch(
    '/functions/v1/atlas-wireless-mvno?api=readiness',
    {
      method: 'GET',
      headers: {
        'x-atlas-org-id': organization.id
      }
    }
  );
  return parseResponse<WirelessMvnoReadiness>(response);
}
