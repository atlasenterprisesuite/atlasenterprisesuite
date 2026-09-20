import { authorizedAtlasFetch, getActiveAtlasOrganization } from '../../lib/atlasSession';
import {
  INITIAL_FRONTIER_ECOLOGY_STATE,
  INITIAL_FRONTIER_EXPANSION_STATE,
  INITIAL_FRONTIER_SURVIVAL_STATE,
  INITIAL_FRONTIER_STATE,
  normalizeFrontierEcologyState,
  normalizeFrontierExpansionState,
  normalizeFrontierSurvivalState,
  normalizeFrontierState,
  type FrontierActionId,
  type FrontierEcologyActionId,
  type FrontierEcologyState,
  type FrontierExpansionActionId,
  type FrontierExpansionState,
  type FrontierSurvivalActionId,
  type FrontierSurvivalState,
  type FrontierState
} from './domain';
import {
  normalizeRotationY,
  type FrontierStructure,
  type WorldPlacement
} from './world3d';

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

type FrontierEcologyRow = {
  seed_pods: number;
  cultivated_plots: number;
  eco_energy: number;
  ecosystem_stability: number;
  restored_biomes: number;
  revision: number;
};

type FrontierExpansionRow = {
  storm_charge: number;
  shelter_integrity: number;
  storm_mastery: number;
  settlements: number;
  civic_links: number;
  civilization_index: number;
  orbital_frames: number;
  orbital_stations: number;
  orbital_reach: number;
  network_links: number;
  trade_volume: number;
  network_integrity: number;
  world_seeds: number;
  worlds_generated: number;
  infinite_mastery: number;
  endless_cycles: number;
  campaign_complete: boolean;
  revision: number;
};

type FrontierSurvivalRow = {
  health: number;
  suit_energy: number;
  shield_integrity: number;
  thermal_stability: number;
  exposure: number;
  active_hazard: string;
  hazard_intensity: number;
  hazard_turns: number;
  survived_events: number;
  revision: number;
};

type FrontierStructureRow = {
  id: string;
  structure_type: string;
  position_x: number;
  position_y: number;
  position_z: number;
  rotation_y: number;
  run_revision: number;
  placement_origin: string;
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

function ecologyRowToState(row: FrontierEcologyRow): FrontierEcologyState {
  return normalizeFrontierEcologyState({
    seedPods: row.seed_pods,
    cultivatedPlots: row.cultivated_plots,
    ecoEnergy: row.eco_energy,
    ecosystemStability: row.ecosystem_stability,
    restoredBiomes: row.restored_biomes,
    revision: row.revision
  });
}

function expansionRowToState(row: FrontierExpansionRow): FrontierExpansionState {
  return normalizeFrontierExpansionState({
    stormCharge: row.storm_charge,
    shelterIntegrity: row.shelter_integrity,
    stormMastery: row.storm_mastery,
    settlements: row.settlements,
    civicLinks: row.civic_links,
    civilizationIndex: row.civilization_index,
    orbitalFrames: row.orbital_frames,
    orbitalStations: row.orbital_stations,
    orbitalReach: row.orbital_reach,
    networkLinks: row.network_links,
    tradeVolume: row.trade_volume,
    networkIntegrity: row.network_integrity,
    worldSeeds: row.world_seeds,
    worldsGenerated: row.worlds_generated,
    infiniteMastery: row.infinite_mastery,
    endlessCycles: row.endless_cycles,
    campaignComplete: row.campaign_complete,
    revision: row.revision
  });
}

function survivalRowToState(row: FrontierSurvivalRow): FrontierSurvivalState {
  return normalizeFrontierSurvivalState({
    health: row.health,
    suitEnergy: row.suit_energy,
    shieldIntegrity: row.shield_integrity,
    thermalStability: row.thermal_stability,
    exposure: row.exposure,
    activeHazard: row.active_hazard,
    hazardIntensity: row.hazard_intensity,
    hazardTurns: row.hazard_turns,
    survivedEvents: row.survived_events,
    revision: row.revision
  });
}

function finiteNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeStructure(value: unknown): FrontierStructure | null {
  if (!value || typeof value !== 'object') return null;
  const source = value as Record<string, any>;
  const structureType = String(source.structureType ?? source.structure_type ?? '');
  if (structureType !== 'habitat') return null;

  const rawPosition = source.position && typeof source.position === 'object'
    ? source.position as Record<string, unknown>
    : null;

  const x = finiteNumber(rawPosition?.x ?? source.position_x);
  const y = finiteNumber(rawPosition?.y ?? source.position_y);
  const z = finiteNumber(rawPosition?.z ?? source.position_z);
  const rotationY = normalizeRotationY(finiteNumber(source.rotationY ?? source.rotation_y));
  const placementOrigin = String(source.placementOrigin ?? source.placement_origin ?? 'legacy_backfill');

  const normalizedOrigin: FrontierStructure['placementOrigin'] =
    placementOrigin === 'governed' || placementOrigin === 'legacy_default' || placementOrigin === 'legacy_backfill'
      ? placementOrigin
      : 'legacy_backfill';

  return {
    id: String(source.id ?? ''),
    structureType: 'habitat',
    position: { x, y, z },
    rotationY,
    runRevision: Math.max(0, Math.floor(finiteNumber(source.runRevision ?? source.run_revision))),
    placementOrigin: normalizedOrigin
  };
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

export async function loadFrontierEcology(): Promise<FrontierEcologyState> {
  const organization = await getActiveAtlasOrganization();
  const org = encodeURIComponent(`eq.${organization.id}`);
  const response = await authorizedAtlasFetch(
    `/rest/v1/frontier_ecology?org_id=${org}&select=seed_pods,cultivated_plots,eco_energy,ecosystem_stability,restored_biomes,revision&limit=1`,
    { method: 'GET' }
  );
  const body = await parseJson(response) as FrontierEcologyRow[];
  if (!Array.isArray(body) || body.length === 0) return { ...INITIAL_FRONTIER_ECOLOGY_STATE };
  return ecologyRowToState(body[0]);
}

export async function loadFrontierExpansion(): Promise<FrontierExpansionState> {
  const organization = await getActiveAtlasOrganization();
  const org = encodeURIComponent(`eq.${organization.id}`);
  const response = await authorizedAtlasFetch(
    `/rest/v1/frontier_expansion?org_id=${org}&select=storm_charge,shelter_integrity,storm_mastery,settlements,civic_links,civilization_index,orbital_frames,orbital_stations,orbital_reach,network_links,trade_volume,network_integrity,world_seeds,worlds_generated,infinite_mastery,endless_cycles,campaign_complete,revision&limit=1`,
    { method: 'GET' }
  );
  const body = await parseJson(response) as FrontierExpansionRow[];
  if (!Array.isArray(body) || body.length === 0) return { ...INITIAL_FRONTIER_EXPANSION_STATE };
  return expansionRowToState(body[0]);
}

export async function loadFrontierSurvival(): Promise<FrontierSurvivalState> {
  const organization = await getActiveAtlasOrganization();
  const org = encodeURIComponent(`eq.${organization.id}`);
  const response = await authorizedAtlasFetch(
    `/rest/v1/frontier_survival?org_id=${org}&select=health,suit_energy,shield_integrity,thermal_stability,exposure,active_hazard,hazard_intensity,hazard_turns,survived_events,revision&limit=1`,
    { method: 'GET' }
  );
  const body = await parseJson(response) as FrontierSurvivalRow[];
  if (!Array.isArray(body) || body.length === 0) return { ...INITIAL_FRONTIER_SURVIVAL_STATE };
  return survivalRowToState(body[0]);
}

export async function loadFrontierStructures(): Promise<FrontierStructure[]> {
  const organization = await getActiveAtlasOrganization();
  const org = encodeURIComponent(`eq.${organization.id}`);
  const response = await authorizedAtlasFetch(
    `/rest/v1/frontier_structures?org_id=${org}&select=id,structure_type,position_x,position_y,position_z,rotation_y,run_revision,placement_origin&order=created_at.asc`,
    { method: 'GET' }
  );
  const body = await parseJson(response) as FrontierStructureRow[];
  if (!Array.isArray(body)) return [];
  return body.map(normalizeStructure).filter((item): item is FrontierStructure => Boolean(item?.id));
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

export async function executeFrontierEcologyAction(
  action: FrontierEcologyActionId,
  idempotencyKey: string
): Promise<{ state: FrontierState; ecology: FrontierEcologyState }> {
  const organization = await getActiveAtlasOrganization();
  const response = await authorizedAtlasFetch('/rest/v1/rpc/frontier_apply_ecology_action', {
    method: 'POST',
    body: JSON.stringify({
      p_org_id: organization.id,
      p_action: action,
      p_idempotency_key: idempotencyKey
    })
  });
  const body = await parseJson(response);
  if (!body?.ok || !body?.state || !body?.ecology) throw new Error('frontier_invalid_ecology_controller_response');
  return {
    state: normalizeFrontierState({ ...body.state, revision: body.revision }),
    ecology: normalizeFrontierEcologyState({ ...body.ecology, revision: body.ecology_revision })
  };
}

export async function executeFrontierExpansionAction(
  action: FrontierExpansionActionId,
  idempotencyKey: string
): Promise<{ state: FrontierState; expansion: FrontierExpansionState }> {
  const organization = await getActiveAtlasOrganization();
  const response = await authorizedAtlasFetch('/rest/v1/rpc/frontier_apply_expansion_action', {
    method: 'POST',
    body: JSON.stringify({
      p_org_id: organization.id,
      p_action: action,
      p_idempotency_key: idempotencyKey
    })
  });
  const body = await parseJson(response);
  if (!body?.ok || !body?.state || !body?.expansion) throw new Error('frontier_invalid_expansion_controller_response');
  return {
    state: normalizeFrontierState({ ...body.state, revision: body.revision }),
    expansion: normalizeFrontierExpansionState({ ...body.expansion, revision: body.expansion_revision })
  };
}

export async function executeFrontierSurvivalAction(
  action: FrontierSurvivalActionId,
  idempotencyKey: string
): Promise<{ state: FrontierState; survival: FrontierSurvivalState }> {
  const organization = await getActiveAtlasOrganization();
  const response = await authorizedAtlasFetch('/rest/v1/rpc/frontier_apply_survival_action', {
    method: 'POST',
    body: JSON.stringify({
      p_org_id: organization.id,
      p_action: action,
      p_idempotency_key: idempotencyKey
    })
  });
  const body = await parseJson(response);
  if (!body?.ok || !body?.state || !body?.survival) throw new Error('frontier_invalid_survival_controller_response');
  return {
    state: normalizeFrontierState({ ...body.state, revision: body.revision }),
    survival: normalizeFrontierSurvivalState({ ...body.survival, revision: body.survival_revision })
  };
}

export async function buildFrontierHabitat(
  placement: WorldPlacement,
  idempotencyKey: string
): Promise<{ state: FrontierState; structure: FrontierStructure }> {
  const organization = await getActiveAtlasOrganization();
  const response = await authorizedAtlasFetch('/rest/v1/rpc/frontier_build_structure', {
    method: 'POST',
    body: JSON.stringify({
      p_org_id: organization.id,
      p_structure_type: 'habitat',
      p_idempotency_key: idempotencyKey,
      p_position_x: placement.x,
      p_position_y: placement.y,
      p_position_z: placement.z,
      p_rotation_y: normalizeRotationY(placement.rotationY)
    })
  });
  const body = await parseJson(response);
  const structure = normalizeStructure(body?.structure);
  if (!body?.ok || !body?.state || !structure?.id) throw new Error('frontier_invalid_structure_controller_response');
  return {
    state: normalizeFrontierState({ ...body.state, revision: body.revision }),
    structure
  };
}
