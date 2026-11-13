import { authorizedAtlasFetch, getActiveAtlasOrganization } from './atlasSession';

export type WirelessLineClaim = {
  id: string;
  masked_number: string;
  status: 'pending_verification' | 'withdrawn';
  created_at: string;
  carrier_verified: false;
  network_active: false;
};

async function rpc<T>(name: 'atlas_wireless_line_list' | 'atlas_wireless_line_submit',
  parameters: Record<string, unknown> = {}): Promise<T> {
  const org = await getActiveAtlasOrganization();
  const response = await authorizedAtlasFetch(`/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ p_org_id: org.id, ...parameters })
  });
  const body = await response.json().catch(() => ({ error: 'invalid_response' }));
  if (!response.ok) throw new Error(String(body?.message || body?.error || `request_failed_${response.status}`));
  return body as T;
}

export async function listWirelessLineClaims(): Promise<WirelessLineClaim[]> {
  const response = await rpc<{ claims: WirelessLineClaim[] }>('atlas_wireless_line_list');
  return response.claims;
}

export async function submitWirelessLineClaim(
  number: string,
  ownershipAsserted: boolean
): Promise<WirelessLineClaim> {
  const response = await rpc<{ claim: WirelessLineClaim }>('atlas_wireless_line_submit', {
    p_number: number,
    p_ownership_asserted: ownershipAsserted
  });
  return response.claim;
}
