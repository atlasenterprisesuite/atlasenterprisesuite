import { authorizedAtlasFetch, getActiveAtlasOrganization } from '../../lib/atlasSession';
import {
  INITIAL_FRONTIER_STATE,
  normalizeFrontierState,
  type FrontierActionId,
  type FrontierState
} from './domain';

type FrontierRunRow = {
  aetherium: number;
  alloy: number;
  biofiber: number;
  power_cores: number;
  habitats: number;
  sky_grid_integrity: number;
  action_count: number;
  storm_minutes: number;
  campaign_stage: number;
  experience: number;
  revision: number;
};

function rowToState(row: FrontierRunRow): FrontierState {
  return normalizeFrontierState({
    aetherium: row.aetherium,
    alloy: row.alloy,
    biofiber: row.biofiber,
    powerCores: row.power_cores,
    habitats: row.habitats,
    skyGridIntegrity: row.sky_grid_integrity,
    actionCount: row.action_count,
    stormMinutes: row.storm_minutes,
    campaignStage: row.campaign_stage,
    experience: row.experience,
    revision: row.revision
  });
}

async function parseJson(response: Response) {
  const text = await response.text();
  let body: any = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { error: text || 'invalid_response' };
  }
  if (!response.ok) {
    throw new Error(body?.message || body?.error_description || body?.error || `Request failed (${response.status})`);
  }
  return body;
}

export async function loadFrontierRun(): Promise<FrontierState> {
  const organization = await getActiveAtlasOrganization();
  const org = encodeURIComponent(`eq.${organization.id}`);
  const response = await authorizedAtlasFetch(
    `/rest/v1/frontier_runs?org_id=${org}&select=aetherium,alloy,biofiber,power_cores,habitats,sky_grid_integrity,action_count,storm_minutes,campaign_stage,experience,revision&limit=1`,
    { method: 'GET' }
  );
  const body = await parseJson(response) as FrontierRunRow[];
  if (!Array.isArray(body) || body.length === 0) return { ...INITIAL_FRONTIER_STATE };
  return rowToState(body[0]);
}

export async function executeFrontierAction(action: FrontierActionId, idempotencyKey: string): Promise<FrontierState> {
  const organization = await getActiveAtlasOrganization();
  const response = await authorizedAtlasFetch('/rest/v1/rpc/frontier_apply_action', {
    method: 'POST',
    body: JSON.stringify({
      p_org_id: organization.id,
      p_action: action,
      p_idempotency_key: idempotencyKey
    })
  });
  const body = await parseJson(response);
  if (!body?.ok || !body?.state) throw new Error('frontier_invalid_controller_response');
  return normalizeFrontierState({ ...body.state, revision: body.revision });
}
