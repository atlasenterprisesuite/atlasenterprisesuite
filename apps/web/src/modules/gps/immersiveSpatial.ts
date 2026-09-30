import type { GpsPoint } from './gpsApi';

export type SpatialRealityMode =
  | 'open-3d'
  | 'photorealistic-3d'
  | 'street-panorama'
  | 'indoor';

export type SpatialProviderState = 'available' | 'external-gated' | 'blocked';

export type SpatialProviderId =
  | 'atlas-open-3d'
  | 'google-photorealistic-3d'
  | 'google-street-view'
  | 'osm-indoor'
  | 'atlas-indoor'
  | 'custom-3d-tiles';

export type SpatialProviderDescriptor = {
  id: SpatialProviderId;
  label: string;
  modes: SpatialRealityMode[];
  state: SpatialProviderState;
  requiresCredential: boolean;
  billing: 'open' | 'provider-account' | 'self-hosted';
  truth: string;
};

export const SPATIAL_PROVIDERS: SpatialProviderDescriptor[] = [
  {
    id: 'atlas-open-3d',
    label: 'ATLAS Open 3D',
    modes: ['open-3d'],
    state: 'available',
    requiresCredential: false,
    billing: 'open',
    truth: 'MapLibre/OpenStreetMap-compatible geometry and terrain. Not photorealistic.'
  },
  {
    id: 'google-photorealistic-3d',
    label: 'Google Photorealistic 3D Tiles',
    modes: ['photorealistic-3d'],
    state: 'external-gated',
    requiresCredential: true,
    billing: 'provider-account',
    truth: 'Only available when an authorized Google Maps Platform/Cesium path is configured.'
  },
  {
    id: 'google-street-view',
    label: 'Google Street View',
    modes: ['street-panorama'],
    state: 'external-gated',
    requiresCredential: true,
    billing: 'provider-account',
    truth: 'Panoramic street imagery. It is not an indoor floor-plan or indoor-routing source.'
  },
  {
    id: 'osm-indoor',
    label: 'OpenStreetMap Indoor',
    modes: ['indoor'],
    state: 'external-gated',
    requiresCredential: false,
    billing: 'open',
    truth: 'Indoor geometry is available only where contributors mapped levels, rooms, corridors and doors.'
  },
  {
    id: 'atlas-indoor',
    label: 'ATLAS Indoor',
    modes: ['indoor'],
    state: 'available',
    requiresCredential: false,
    billing: 'self-hosted',
    truth: 'Organization-scoped indoor data owned or authorized by the ATLAS tenant.'
  },
  {
    id: 'custom-3d-tiles',
    label: 'Tenant 3D Tiles / GLB',
    modes: ['photorealistic-3d', 'indoor'],
    state: 'available',
    requiresCredential: false,
    billing: 'self-hosted',
    truth: 'Tenant-controlled scans, BIM exports or 3D Tiles published through governed ATLAS storage.'
  }
];

export type IndoorNodeKind =
  | 'entrance'
  | 'corridor'
  | 'room'
  | 'stairs'
  | 'elevator'
  | 'escalator'
  | 'poi';

export type IndoorPosition = {
  x_m: number;
  y_m: number;
  z_m: number;
  level: string;
};

export type IndoorNode = {
  id: string;
  label: string;
  kind: IndoorNodeKind;
  position: IndoorPosition;
  connectsTo: string[];
  accessible?: boolean;
};

export type IndoorLevel = {
  id: string;
  label: string;
  elevation_m: number;
};

export type IndoorBuilding = {
  id: string;
  label: string;
  organization_id: string | null;
  source: 'atlas' | 'osm' | 'tenant-scan';
  center: GpsPoint;
  levels: IndoorLevel[];
  nodes: IndoorNode[];
  entranceNodeIds: string[];
  model_uri?: string | null;
  updated_at?: string | null;
};

export type SpatialModeDecision = {
  requested: SpatialRealityMode;
  resolved: SpatialRealityMode;
  state: SpatialProviderState;
  reason: string;
  provider: SpatialProviderId;
};

export type SpatialReadiness = {
  googlePhotorealisticConfigured: boolean;
  streetPanoramaConfigured: boolean;
  openIndoorConfigured: boolean;
  tenantIndoorAvailable: boolean;
};

export function resolveSpatialMode(
  requested: SpatialRealityMode,
  readiness: SpatialReadiness
): SpatialModeDecision {
  if (requested === 'photorealistic-3d') {
    if (readiness.googlePhotorealisticConfigured) {
      return {
        requested,
        resolved: requested,
        state: 'external-gated',
        reason: 'Authorized photorealistic provider configured.',
        provider: 'google-photorealistic-3d'
      };
    }
    return {
      requested,
      resolved: 'open-3d',
      state: 'blocked',
      reason: 'Photorealistic provider is not configured; fail-closed to ATLAS Open 3D.',
      provider: 'atlas-open-3d'
    };
  }

  if (requested === 'street-panorama') {
    if (readiness.streetPanoramaConfigured) {
      return {
        requested,
        resolved: requested,
        state: 'external-gated',
        reason: 'Authorized street-level panorama provider configured.',
        provider: 'google-street-view'
      };
    }
    return {
      requested,
      resolved: 'open-3d',
      state: 'blocked',
      reason: 'Street-level imagery is not configured; no imagery is fabricated.',
      provider: 'atlas-open-3d'
    };
  }

  if (requested === 'indoor') {
    if (readiness.tenantIndoorAvailable) {
      return {
        requested,
        resolved: requested,
        state: 'available',
        reason: 'Authorized tenant indoor model available.',
        provider: 'atlas-indoor'
      };
    }
    if (readiness.openIndoorConfigured) {
      return {
        requested,
        resolved: requested,
        state: 'external-gated',
        reason: 'Open indoor provider configured; coverage remains building-specific.',
        provider: 'osm-indoor'
      };
    }
    return {
      requested,
      resolved: 'open-3d',
      state: 'blocked',
      reason: 'No authorized indoor model exists for this building.',
      provider: 'atlas-open-3d'
    };
  }

  return {
    requested,
    resolved: 'open-3d',
    state: 'available',
    reason: 'ATLAS Open 3D is available without a paid imagery dependency.',
    provider: 'atlas-open-3d'
  };
}

export function validateIndoorBuilding(building: IndoorBuilding) {
  const nodeIds = new Set(building.nodes.map((node) => node.id));
  const levelIds = new Set(building.levels.map((level) => level.id));

  if (!building.id || !building.label) return { ok: false as const, error: 'building_identity_missing' };
  if (!building.nodes.length) return { ok: false as const, error: 'building_nodes_missing' };
  if (!building.entranceNodeIds.length) return { ok: false as const, error: 'building_entrance_missing' };

  for (const entrance of building.entranceNodeIds) {
    if (!nodeIds.has(entrance)) return { ok: false as const, error: 'building_entrance_invalid' };
  }

  for (const node of building.nodes) {
    if (!levelIds.has(node.position.level)) return { ok: false as const, error: 'building_level_invalid' };
    for (const target of node.connectsTo) {
      if (!nodeIds.has(target)) return { ok: false as const, error: 'building_edge_invalid' };
    }
  }

  return { ok: true as const };
}

export function findIndoorRoute(
  building: IndoorBuilding,
  fromNodeId: string,
  toNodeId: string,
  accessibleOnly = false
): IndoorNode[] {
  const validation = validateIndoorBuilding(building);
  if (!validation.ok) return [];

  const byId = new Map(building.nodes.map((node) => [node.id, node]));
  if (!byId.has(fromNodeId) || !byId.has(toNodeId)) return [];

  const queue: string[] = [fromNodeId];
  const previous = new Map<string, string | null>([[fromNodeId, null]]);

  while (queue.length) {
    const currentId = queue.shift()!;
    if (currentId === toNodeId) break;
    const current = byId.get(currentId);
    if (!current) continue;

    for (const nextId of current.connectsTo) {
      if (previous.has(nextId)) continue;
      const next = byId.get(nextId);
      if (!next) continue;
      if (accessibleOnly && next.accessible === false) continue;
      previous.set(nextId, currentId);
      queue.push(nextId);
    }
  }

  if (!previous.has(toNodeId)) return [];

  const path: IndoorNode[] = [];
  let cursor: string | null = toNodeId;
  while (cursor) {
    const node = byId.get(cursor);
    if (!node) return [];
    path.push(node);
    cursor = previous.get(cursor) ?? null;
  }

  return path.reverse();
}
