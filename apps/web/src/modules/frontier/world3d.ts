import type { FrontierActionId } from './domain';

export type WorldPoint = { x: number; z: number };

export const FRONTIER_WORLD_LIMIT = 8;
export const FRONTIER_PLAYER_RADIUS = 0.38;
export const FRONTIER_MAX_TERRAIN_STEP = 0.72;
export const FRONTIER_RENDER_DPR_LIMIT = 2;
export const FRONTIER_FRAME_DELTA_LIMIT_SECONDS = 0.05;

export type WorldPlacement = WorldPoint & {
  y: number;
  rotationY: number;
};

export type FrontierStructure = {
  id: string;
  structureType: 'habitat';
  position: { x: number; y: number; z: number };
  rotationY: number;
  runRevision: number;
  placementOrigin: 'governed' | 'legacy_default' | 'legacy_backfill';
};

export type ResourceTarget = {
  id: 'aetherium' | 'alloy' | 'biofiber';
  label: string;
  action: FrontierActionId;
  x: number;
  z: number;
  color: readonly [number, number, number, number];
};

export const FRONTIER_RESOURCE_TARGETS: readonly ResourceTarget[] = [
  { id: 'aetherium', label: 'Aetherium seam', action: 'extract_aetherium', x: -3.2, z: -1.2, color: [0.28, 0.88, 1, 1] },
  { id: 'alloy', label: 'Alloy wreckage', action: 'salvage_alloy', x: 3.4, z: 1.8, color: [0.48, 0.62, 0.75, 1] },
  { id: 'biofiber', label: 'Biofiber grove', action: 'harvest_biofiber', x: -1.2, z: 4.6, color: [0.36, 0.92, 0.6, 1] }
] as const;

export function clampWorldPoint(point: WorldPoint, limit = FRONTIER_WORLD_LIMIT): WorldPoint {
  return {
    x: Math.max(-limit, Math.min(limit, point.x)),
    z: Math.max(-limit, Math.min(limit, point.z))
  };
}

export function moveWorldPoint(point: WorldPoint, dx: number, dz: number, speed = 1): WorldPoint {
  return clampWorldPoint({ x: point.x + dx * speed, z: point.z + dz * speed });
}

export function frontierTerrainHeight(point: WorldPoint) {
  const waveA = Math.sin(point.x * 0.48) * 0.2;
  const waveB = Math.cos(point.z * 0.37) * 0.16;
  const ridge = Math.sin((point.x + point.z) * 0.21) * 0.09;
  return Number((waveA + waveB + ridge).toFixed(4));
}

function collidesWithStructure(point: WorldPoint, structures: readonly FrontierStructure[], padding = 1.28) {
  return structures.some((structure) =>
    Math.hypot(point.x - structure.position.x, point.z - structure.position.z) < padding + FRONTIER_PLAYER_RADIUS
  );
}

function collidesWithProtectedResource(point: WorldPoint, padding = 0.82) {
  return FRONTIER_RESOURCE_TARGETS.some((target) =>
    Math.hypot(point.x - target.x, point.z - target.z) < padding + FRONTIER_PLAYER_RADIUS
  );
}

export function resolveCollisionSafeMove(
  current: WorldPoint,
  next: WorldPoint,
  structures: readonly FrontierStructure[]
): WorldPoint {
  const bounded = clampWorldPoint(next);
  const candidates: WorldPoint[] = [
    bounded,
    { x: bounded.x, z: current.z },
    { x: current.x, z: bounded.z }
  ];

  for (const candidate of candidates) {
    const terrainStep = Math.abs(frontierTerrainHeight(candidate) - frontierTerrainHeight(current));
    if (terrainStep > FRONTIER_MAX_TERRAIN_STEP) continue;
    if (collidesWithStructure(candidate, structures)) continue;
    if (collidesWithProtectedResource(candidate)) continue;
    return candidate;
  }

  return clampWorldPoint(current);
}

export function raycastResourceTarget(
  origin: WorldPoint,
  aim: WorldPoint,
  maxDistance = 8,
  hitRadius = 1.15
): ResourceTarget | null {
  const dx = aim.x - origin.x;
  const dz = aim.z - origin.z;
  const length = Math.hypot(dx, dz);
  if (length < 0.001) return nearestResourceTarget(origin, hitRadius);

  const ux = dx / length;
  const uz = dz / length;
  let best: ResourceTarget | null = null;
  let bestForward = maxDistance;

  for (const target of FRONTIER_RESOURCE_TARGETS) {
    const tx = target.x - origin.x;
    const tz = target.z - origin.z;
    const forward = tx * ux + tz * uz;
    if (forward < 0 || forward > maxDistance || forward > bestForward) continue;
    const perpendicular = Math.abs(tx * uz - tz * ux);
    if (perpendicular <= hitRadius) {
      best = target;
      bestForward = forward;
    }
  }

  return best;
}

export function distanceToTarget(point: WorldPoint, target: ResourceTarget) {
  return Math.hypot(point.x - target.x, point.z - target.z);
}

export function nearestResourceTarget(point: WorldPoint, maxDistance = 3.2): ResourceTarget | null {
  let nearest: ResourceTarget | null = null;
  let distance = maxDistance;
  for (const target of FRONTIER_RESOURCE_TARGETS) {
    const next = distanceToTarget(point, target);
    if (next <= distance) {
      distance = next;
      nearest = target;
    }
  }
  return nearest;
}

export function screenToPlacement(clientX: number, clientY: number, width: number, height: number): WorldPoint {
  const safeWidth = Math.max(1, width);
  const safeHeight = Math.max(1, height);
  const x = ((clientX / safeWidth) - 0.5) * 14;
  const z = ((clientY / safeHeight) - 0.5) * 11;
  return clampWorldPoint({ x, z }, 6.5);
}


export function normalizeRotationY(value: number) {
  if (!Number.isFinite(value)) return 0;
  const twoPi = Math.PI * 2;
  let normalized = ((value + Math.PI) % twoPi + twoPi) % twoPi - Math.PI;
  if (Object.is(normalized, -0)) normalized = 0;
  return normalized;
}

export function toWorldPlacement(point: WorldPoint, rotationY = 0): WorldPlacement {
  const bounded = clampWorldPoint(point, 6.5);
  return {
    x: bounded.x,
    y: 0,
    z: bounded.z,
    rotationY: normalizeRotationY(rotationY)
  };
}
