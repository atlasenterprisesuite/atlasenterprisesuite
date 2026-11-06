import { describe, expect, it } from 'vitest';
import {
  SPATIAL_GLASSES_SCENES,
  resolveSpatialGlassesPreview
} from '../../apps/web/src/modules/device-os/spatialGlassesPreviewModel';

describe('ATLAS Glasses local simulation boundary', () => {
  it('renders a clearly marked browser simulation with no hardware privileges', () => {
    for (const scene of SPATIAL_GLASSES_SCENES) {
      const result = resolveSpatialGlassesPreview(scene.id);
      expect(result.state).toBe('simulation');
      expect(result.hardwareConnected).toBe(false);
      expect(result.externalActionsAllowed).toBe(false);
      if (result.state === 'simulation') {
        expect(result.scene.description).toMatch(/illustrative|concept/i);
      }
    }
  });

  it.each(['specs', 'visionos'] as const)('blocks %s until a separate trusted adapter is verified', (runtime) => {
    const result = resolveSpatialGlassesPreview('workspace', runtime);
    expect(result).toEqual({ state: 'blocked', reason: 'external_runtime_not_verified', hardwareConnected: false, externalActionsAllowed: false });
  });

  it('rejects unknown or injected scene ids', () => {
    expect(resolveSpatialGlassesPreview('workspace/../../tenant')).toEqual({
      state: 'blocked', reason: 'unknown_scene', hardwareConnected: false, externalActionsAllowed: false
    });
  });

  it('never exposes a connected camera, location, microphone, or AI provider in preview copy', () => {
    const allCopy = JSON.stringify(SPATIAL_GLASSES_SCENES).toLowerCase();
    expect(allCopy).toContain('microphone: off');
    expect(allCopy).toContain('location: unavailable');
    expect(allCopy).toContain('ai session: not connected');
  });
});
