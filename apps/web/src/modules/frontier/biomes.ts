export type FrontierWorldPoint = { x: number; z: number };

export type FrontierBiomeId =
  | 'luminous_forest'
  | 'crystalline_desert'
  | 'biofiber_ocean'
  | 'ionic_tundra'
  | 'floating_mountains'
  | 'abandoned_technological_city';

export type FrontierBiomeRegion = {
  id: FrontierBiomeId;
  entryId: string;
  label: string;
  requiredStage: number;
  center: FrontierWorldPoint;
  size: FrontierWorldPoint;
  color: readonly [number, number, number, number];
};

export type FrontierWorldPresence = {
  position: FrontierWorldPoint;
  biomeEntryId: string;
  revision: number;
};

export const FRONTIER_BIOME_REGIONS: readonly FrontierBiomeRegion[] = [
  {
    id: 'luminous_forest',
    entryId: 'biome-luminous-grove',
    label: 'Luminous Forest',
    requiredStage: 1,
    center: { x: 0, z: 0 },
    size: { x: 8, z: 10 },
    color: [0.055, 0.25, 0.18, 1]
  },
  {
    id: 'crystalline_desert',
    entryId: 'biome-aether-fields',
    label: 'Crystalline Desert',
    requiredStage: 3,
    center: { x: -6, z: 0 },
    size: { x: 4, z: 16 },
    color: [0.30, 0.20, 0.12, 1]
  },
  {
    id: 'biofiber_ocean',
    entryId: 'biome-tidal-reefs',
    label: 'Biofiber Ocean',
    requiredStage: 5,
    center: { x: 0, z: 6.5 },
    size: { x: 8, z: 3 },
    color: [0.03, 0.22, 0.30, 1]
  },
  {
    id: 'ionic_tundra',
    entryId: 'biome-thermal-rifts',
    label: 'Ionic Tundra',
    requiredStage: 6,
    center: { x: 0, z: -6.5 },
    size: { x: 8, z: 3 },
    color: [0.12, 0.24, 0.34, 1]
  },
  {
    id: 'floating_mountains',
    entryId: 'biome-cloud-steppe',
    label: 'Floating Mountains',
    requiredStage: 8,
    center: { x: 6, z: -4 },
    size: { x: 4, z: 8 },
    color: [0.18, 0.16, 0.34, 1]
  },
  {
    id: 'abandoned_technological_city',
    entryId: 'biome-abandoned-city',
    label: 'Abandoned Technological City',
    requiredStage: 9,
    center: { x: 6, z: 4 },
    size: { x: 4, z: 8 },
    color: [0.09, 0.12, 0.18, 1]
  }
] as const;

export const INITIAL_FRONTIER_WORLD_PRESENCE: FrontierWorldPresence = {
  position: { x: 0, z: 2.8 },
  biomeEntryId: 'biome-luminous-grove',
  revision: 0
};

const BY_ID = new Map(FRONTIER_BIOME_REGIONS.map((biome) => [biome.id, biome]));
const BY_ENTRY = new Map(FRONTIER_BIOME_REGIONS.map((biome) => [biome.entryId, biome]));

export function frontierBiomeAt(point: FrontierWorldPoint): FrontierBiomeRegion {
  if (point.x < -4) return BY_ID.get('crystalline_desert')!;
  if (point.x > 4 && point.z < 0) return BY_ID.get('floating_mountains')!;
  if (point.x > 4) return BY_ID.get('abandoned_technological_city')!;
  if (point.z < -5) return BY_ID.get('ionic_tundra')!;
  if (point.z > 5) return BY_ID.get('biofiber_ocean')!;
  return BY_ID.get('luminous_forest')!;
}

export function frontierBiomeForEntry(entryId: string) {
  return BY_ENTRY.get(entryId) ?? null;
}

export function isFrontierBiomeUnlocked(biome: FrontierBiomeRegion, campaignStage: number) {
  return campaignStage >= biome.requiredStage;
}

export function resolveFrontierBiomeMovement(
  current: FrontierWorldPoint,
  requested: FrontierWorldPoint,
  campaignStage: number
): {
  point: FrontierWorldPoint;
  biome: FrontierBiomeRegion;
  changedBiome: boolean;
  blockedBiome: FrontierBiomeRegion | null;
} {
  const currentBiome = frontierBiomeAt(current);
  const requestedBiome = frontierBiomeAt(requested);

  if (!isFrontierBiomeUnlocked(requestedBiome, campaignStage)) {
    return {
      point: current,
      biome: currentBiome,
      changedBiome: false,
      blockedBiome: requestedBiome
    };
  }

  return {
    point: requested,
    biome: requestedBiome,
    changedBiome: currentBiome.id !== requestedBiome.id,
    blockedBiome: null
  };
}
