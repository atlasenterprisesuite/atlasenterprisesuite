import { authorizedAtlasFetch, getActiveAtlasOrganization } from './atlasSession';

export type WirelessLineClaim = {
  id: string;
  masked_number: string;
  status: 'pending_verification' | 'withdrawn';
  created_at: string;
  carrier_verified: false;
  network_active: false;
};

async function request<T>(api: 'list' | 'submit', init: RequestInit = {}): Promise<T> {
  const org = await getActiveAtlasOrganization();
  const response = await authorizedAtlasFetch(`/functions/v1/atlas-wireless-line?api=${api}`, {
    ...init,
    headers: { ...(init.headers || {}), 'x-atlas-org-id': org.id }
  });
  const body = await response.json().catch(() => ({ error: 'invalid_response' }));
  if (!response.ok) throw new Error(String(body?.error || `request_failed_${response.status}`));
  return body as T;
}

export async function listWirelessLineClaims(): Promise<WirelessLineClaim[]> {
  const result = await request<{ claims: WirelessLineClaim[] }>('list', { method: 'GET' });
  return result.claims;
}

export async function submitWirelessLineClaim(
  number: string,
  ownershipAsserted: boolean
): Promise<WirelessLineClaim> {
  const result = await request<{ claim: WirelessLineClaim }>('submit', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ number, ownership_asserted: ownershipAsserted })
  });
  return result.claim;
}
