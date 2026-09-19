import { describe, expect, it } from 'vitest';
import {
  FRONTIER_RESOURCE_TARGETS,
  clampWorldPoint,
  moveWorldPoint,
  nearestResourceTarget,
  screenToPlacement
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
});
