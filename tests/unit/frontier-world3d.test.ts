import { describe, expect, it } from 'vitest';
import {
  FRONTIER_RESOURCE_TARGETS,
  clampWorldPoint,
  frontierTerrainHeight,
  moveWorldPoint,
  nearestResourceTarget,
  normalizeRotationY,
  raycastResourceTarget,
  resolveCollisionSafeMove,
  screenToPlacement,
  toWorldPlacement
} from '../../apps/web/src/modules/frontier/world3d';

describe('ATLAS FRONTIER spatial world', () => {
  it('keeps player movement inside the playable world bounds', () => {
    expect(clampWorldPoint({ x: 30, z: -30 })).toEqual({ x: 8, z: -8 });
    expect(moveWorldPoint({ x: 7.8, z: 0 }, 1, 0, 2)).toEqual({ x: 8, z: 0 });
  });

  it('selects nearby governed resource targets without inventing actions', () => {
    const aetherium = FRONTIER_RESOURCE_TARGETS.find((target) => target.id === 'aetherium');
    expect(aetherium).toBeDefined();
    expect(nearestResourceTarget({ x: -3.1, z: -1.1 })?.action).toBe('extract_aetherium');
    expect(nearestResourceTarget({ x: 8, z: 8 }, 1)).toBeNull();
  });

  it('uses deterministic elevation and collision-safe traversal', () => {
    const point = { x: 2.5, z: -1.25 };
    expect(frontierTerrainHeight(point)).toBe(frontierTerrainHeight(point));

    const structure = {
      id: 'habitat-1',
      structureType: 'habitat' as const,
      position: { x: 2, y: 0, z: 2 },
      rotationY: 0,
      runRevision: 1,
      placementOrigin: 'governed' as const
    };

    const blocked = resolveCollisionSafeMove({ x: 0, z: 2 }, { x: 2, z: 2 }, [structure]);
    expect(blocked).not.toEqual({ x: 2, z: 2 });
  });

  it('raycasts governed resource nodes from a spatial aim vector', () => {
    expect(raycastResourceTarget({ x: 0, z: 0 }, { x: -6, z: -2 })?.id).toBe('aetherium');
    expect(raycastResourceTarget({ x: 7, z: 7 }, { x: 8, z: 8 }, 2)).toBeNull();
  });

  it('maps pointer placement into a bounded build area', () => {
    expect(screenToPlacement(500, 250, 1000, 500)).toEqual({ x: 0, z: 0 });
    const edge = screenToPlacement(1000, 500, 1000, 500);
    expect(edge.x).toBeLessThanOrEqual(6.5);
    expect(edge.z).toBeLessThanOrEqual(6.5);
  });

  it('normalizes durable building rotation and transform', () => {
    expect(normalizeRotationY(Math.PI * 3)).toBeCloseTo(-Math.PI);
    expect(normalizeRotationY(Number.NaN)).toBe(0);
    expect(toWorldPlacement({ x: 99, z: -99 }, Math.PI / 2)).toEqual({
      x: 6.5,
      y: 0,
      z: -6.5,
      rotationY: Math.PI / 2
    });
  });
});
