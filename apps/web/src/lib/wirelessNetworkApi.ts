import { authorizedAtlasFetch, getActiveAtlasOrganization } from './atlasSession';

export type WirelessNetworkReadiness = {
  ok: boolean;
  service: 'atlas-wireless-network';
  organization_id: string;
  role: string;
  service_provider: 'atlas-wireless';
  profile_configured: boolean;
  network_mode: 'atlas-owned' | 'hybrid' | 'wholesale-fallback';
  lab_ready: boolean;
  technical_public_ready: boolean;
  blockers: string[];
  components: Array<{
    organizationId: string;
    layer: string;
    state: string;
    blocker: string | null;
    checkedAt: string;
    evidenceRefs: Array<{ organizationId: string; reference: string }>;
  }>;
  checked_at: string;
};

export type WirelessNetworkInventory = WirelessNetworkReadiness & {
  inventory: {
    ran_sites: Array<Record<string, unknown>>;
    spectrum_authorizations: Array<Record<string, unknown>>;
    backhaul_links: Array<Record<string, unknown>>;
  };
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

async function wirelessNetworkRequest<T>(api: 'readiness' | 'inventory'): Promise<T> {
  const organization = await getActiveAtlasOrganization();
  const response = await authorizedAtlasFetch(
    `/functions/v1/atlas-wireless-network?api=${api}`,
    {
      method: 'GET',
      headers: {
        'x-atlas-org-id': organization.id
      }
    }
  );
  return parseResponse<T>(response);
}

export function getWirelessNetworkReadiness(): Promise<WirelessNetworkReadiness> {
  return wirelessNetworkRequest<WirelessNetworkReadiness>('readiness');
}

export function getWirelessNetworkInventory(): Promise<WirelessNetworkInventory> {
  return wirelessNetworkRequest<WirelessNetworkInventory>('inventory');
}
