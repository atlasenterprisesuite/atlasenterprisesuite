import { authorizedAtlasFetch, getActiveAtlasOrganization } from '../lib/atlasSession';
import { listWorkConnections, type WorkConnectionSummary } from '../work/api';

export type AtlasInternalBlocker = {
  stage: string;
  code: string;
  detail: string;
};

export type AtlasInternalControlSnapshot = {
  role: string | null;
  privileged: boolean;
  connections: WorkConnectionSummary[];
  productionReadiness: string;
  blockers: AtlasInternalBlocker[];
};

async function parse(response: Response) {
  const raw = await response.text();
  let data: Record<string, any> = {};
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    data = { error: raw || 'invalid_response' };
  }
  if (!response.ok || data.ok === false) {
    throw new Error(String(data.error || data.message || `atlas_internal_request_failed_${response.status}`));
  }
  return data;
}

export async function getAtlasInfrastructureStatus() {
  const organization = await getActiveAtlasOrganization();
  const response = await authorizedAtlasFetch('/functions/v1/atlas-infra-status', {
    method: 'GET',
    headers: { 'x-atlas-org-id': organization.id }
  });
  return parse(response);
}

export async function loadAtlasInternalControl(role: string | null): Promise<AtlasInternalControlSnapshot> {
  const privileged = ['owner', 'admin', 'platform_admin'].includes(String(role || ''));
  if (!privileged) {
    return {
      role,
      privileged: false,
      connections: [],
      productionReadiness: 'permission-required',
      blockers: []
    };
  }

  const [connectionsResult, infrastructureResult] = await Promise.allSettled([
    listWorkConnections(),
    getAtlasInfrastructureStatus()
  ]);

  const connections = connectionsResult.status === 'fulfilled' ? connectionsResult.value : [];
  const infrastructure = infrastructureResult.status === 'fulfilled' ? infrastructureResult.value : {};
  const blockers = Array.isArray(infrastructure.blockers)
    ? infrastructure.blockers
        .filter((item: unknown) => item && typeof item === 'object')
        .map((item: any) => ({
          stage: String(item.stage || 'unknown'),
          code: String(item.code || 'unknown'),
          detail: String(item.detail || '')
        }))
        .slice(0, 12)
    : [];

  return {
    role,
    privileged: true,
    connections,
    productionReadiness: String(infrastructure.production_readiness || 'unknown'),
    blockers
  };
}
