import type { FrontierActionId } from './domain';

export type WorldPoint = { x: number; z: number };

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

export function clampWorldPoint(point: WorldPoint, limit = 8): WorldPoint {
  return {
    x: Math.max(-limit, Math.min(limit, point.x)),
    z: Math.max(-limit, Math.min(limit, point.z))
  };
}

export function moveWorldPoint(point: WorldPoint, dx: number, dz: number, speed = 1): WorldPoint {
  return clampWorldPoint({ x: point.x + dx * speed, z: point.z + dz * speed });
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
