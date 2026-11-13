import { authorizedAtlasFetch, getActiveAtlasOrganization } from './atlasSession';

export type CarrierLabChannel = 'voice' | 'sms' | 'data' | 'esim';
export type CarrierLabScenario = 'success' | 'provider_unavailable' | 'timeout' | 'unauthorized';

export type CarrierLabReport = {
  ok: true;
  mode: 'simulation';
  productionReady: false;
  organizationId: string;
  channel: CarrierLabChannel;
  scenario: CarrierLabScenario;
  total: number;
  passed: number;
  failed: number;
  events: Array<{
    id: string;
    organizationId: string;
    channel: CarrierLabChannel;
    scenario: CarrierLabScenario;
    outcome: 'simulated_success' | 'simulated_failure';
    latencyMs: number;
    synthetic: true;
    providerEvidence: null;
    realNumber: null;
    esimProfile: null;
  }>;
};

export async function executeCarrierLab(input: {
  channel: CarrierLabChannel;
  scenario: CarrierLabScenario;
  count: number;
  seed: number;
}): Promise<CarrierLabReport> {
  const organization = await getActiveAtlasOrganization();
  const response = await authorizedAtlasFetch('/functions/v1/atlas-carrier-lab', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-atlas-org-id': organization.id
    },
    body: JSON.stringify(input)
  });
  const data = await response.json().catch(() => ({ error: 'invalid_response' }));
  if (!response.ok) throw new Error(String(data.error || 'lab_unavailable'));
  if (data.mode !== 'simulation' || data.productionReady !== false) {
    throw new Error('unexpected_lab_mode');
  }
  return data as CarrierLabReport;
}
