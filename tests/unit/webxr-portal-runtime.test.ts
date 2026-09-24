import { describe, expect, it } from 'vitest';
import { classifySpatialCapability } from '../../apps/web/src/modules/galaxy/webxrPortalRuntime';

describe('ATLAS spatial portal capability classification', () => {
  it('prefers immersive AR when the device exposes it', () => {
    expect(classifySpatialCapability({
      secureContext: true,
      immersiveAr: true,
      immersiveVr: true
    })).toMatchObject({
      capability: 'webxr-ar',
      immersiveAr: true,
      immersiveVr: true
    });
  });

  it('falls back truthfully to immersive VR when passthrough AR is unavailable', () => {
    const result = classifySpatialCapability({
      secureContext: true,
      immersiveAr: false,
      immersiveVr: true
    });
    expect(result.capability).toBe('webxr-vr');
    expect(result.immersiveAr).toBe(false);
    expect(result.reason).toContain('passthrough AR is not exposed');
  });

  it('fails closed to browser 3D outside a secure context', () => {
    const result = classifySpatialCapability({
      secureContext: false,
      immersiveAr: true,
      immersiveVr: true
    });
    expect(result.capability).toBe('browser-3d');
    expect(result.immersiveAr).toBe(false);
    expect(result.immersiveVr).toBe(false);
  });

  it('uses browser 3D when no immersive WebXR mode is available', () => {
    expect(classifySpatialCapability({
      secureContext: true,
      immersiveAr: false,
      immersiveVr: false
    }).capability).toBe('browser-3d');
  });
});
