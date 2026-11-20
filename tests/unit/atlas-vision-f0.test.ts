import { describe, expect, it } from 'vitest';
import { getAtlasDeviceProfile } from '../../apps/web/src/modules/device-os/deviceOSModel';
import { ATLAS_HARDWARE_CONCEPTS } from '../../apps/web/src/modules/device-os/deviceEvolutionModel';

describe('ATLAS Vision 777 F0 safety contract', () => {
  it('retains all physical glasses capabilities behind an adapter', () => {
    const glasses = getAtlasDeviceProfile('glasses');
    for (const name of ['Spatial camera', 'Waveguide display', 'Microphone array']) {
      const capability = glasses.capabilities.find((item) => item.label === name);
      expect(capability?.status).toBe('adapter-required');
    }
  });

  it('does not promote conceptual ATLAS Vision to verified physical hardware', () => {
    const vision = ATLAS_HARDWARE_CONCEPTS.find((item) => item.id === 'vision');
    expect(vision?.status).toBe('research-track');
  });
});
