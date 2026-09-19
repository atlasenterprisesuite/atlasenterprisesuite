import { describe, expect, it } from 'vitest';
import {
  FRONTIER_RESOURCE_TARGETS,
  clampWorldPoint,
  moveWorldPoint,
  nearestResourceTarget,
  screenToPlacement,
  normalizeRotationY,
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
