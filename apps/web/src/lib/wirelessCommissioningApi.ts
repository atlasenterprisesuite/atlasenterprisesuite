import { authorizedAtlasFetch, getActiveAtlasOrganization } from './atlasSession';

export type CommissioningRun = {
  id: string;
  org_id: string;
  site_code: string;
  display_name: string;
  state: 'planned' | 'evidence_collection' | 'validation' | 'ready_for_approval' | 'commissioned' | 'rejected';
  target_mode: 'atlas-owned' | 'hybrid';
  approved_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CommissioningTask = {
  id: string;
  org_id: string;
  run_id: string;
  task_code: string;
  state: 'pending' | 'passed' | 'failed' | 'not_applicable';
  evidence_refs: string[];
  verified_at: string | null;
  notes: string | null;
};

async function request<T>(api: string, init: RequestInit = {}): Promise<T> {
  const organization = await getActiveAtlasOrganization();
  const response = await authorizedAtlasFetch(
    `/functions/v1/atlas-wireless-commissioning?api=${encodeURIComponent(api)}`,
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
  if (!response.ok) {
    const error = Object.assign(new Error(String(data?.error || `request_failed_${response.status}`)), {
      status: response.status,
      data
    });
    throw error;
  }
  return data as T;
}

export function listWirelessCommissioning(): Promise<{
  ok: true;
  service: 'atlas-wireless-commissioning';
  runs: CommissioningRun[];
  tasks: CommissioningTask[];
}> {
  return request('list', { method: 'GET' });
}
