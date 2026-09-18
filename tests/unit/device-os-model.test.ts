import { describe, expect, it } from 'vitest';
import {
  ATLAS_DEVICE_PROFILES,
  getAtlasDeviceProfile,
  summarizeDeviceReadiness
} from '../../apps/web/src/modules/device-os/deviceOSModel';

describe('ATLAS Device OS model', () => {
  it('registers the ten approved ATLAS device profiles', () => {
    expect(ATLAS_DEVICE_PROFILES.map((profile) => profile.id)).toEqual([
      'phone', 'fold', 'tablet', 'watch', 'glasses', 'ring', 'buds', 'laptop', 'home', 'car'
    ]);
  });

  it('keeps hardware dependencies fail-closed', () => {
    const phone = getAtlasDeviceProfile('phone');
    const readiness = summarizeDeviceReadiness(phone);

    expect(readiness.softwareReady).toBeGreaterThan(0);
    expect(readiness.adapterRequired).toBeGreaterThan(0);
    expect(phone.capabilities.some((capability) => capability.status === 'adapter-required')).toBe(true);
  });

  it('shares governed core capabilities across every device profile', () => {
    for (const profile of ATLAS_DEVICE_PROFILES) {
      const ids = profile.capabilities.map((capability) => capability.id);
      expect(ids).toEqual(expect.arrayContaining(['identity', 'connect', 'privacy', 'automation']));
    }
  });
});
