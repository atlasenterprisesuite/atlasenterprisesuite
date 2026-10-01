import { describe, expect, it } from 'vitest';
import {
  ATLAS_BOOT_PIPELINE,
  ATLAS_HARDWARE_CONCEPTS,
  ATLAS_RECOVERY_PIPELINE,
  classifyAdaptiveProfile
} from '../../apps/web/src/modules/device-os/deviceEvolutionModel';

describe('ATLAS Device DNA architecture', () => {
  it('keeps the normal and recovery pipelines explicit', () => {
    expect(ATLAS_BOOT_PIPELINE).toEqual([
      'Power',
      'Device DNA',
      'Hardware check',
      'Security check',
      'Adaptive profile',
      'Operating system',
      'ATLAS'
    ]);
    expect(ATLAS_RECOVERY_PIPELINE).toContain('Phoenix mode');
    expect(ATLAS_RECOVERY_PIPELINE.at(-1)).toBe('Boot');
  });

  it('contains the approved hardware family without claiming physical readiness', () => {
    const names = ATLAS_HARDWARE_CONCEPTS.map((concept) => concept.name);
    expect(names).toContain('ATLAS Device DNA');
    expect(names).toContain('ATLAS Phoenix');
    expect(names).toContain('ATLAS Rescue Key');
    expect(names).toContain('ATLAS Core');
    expect(names).toContain('ATLAS Shell');
    expect(names).toContain('ATLAS Neural Dock');
    expect(names).toContain('ATLAS Halo');
    expect(names).toContain('ATLAS Vision');
    expect(names).toContain('ATLAS FieldPad');
    expect(names).toContain('ATLAS Mesh Nodes');
    expect(ATLAS_HARDWARE_CONCEPTS.every((concept) => concept.status !== undefined)).toBe(true);
  });

  it('classifies constrained and high-performance profiles deterministically', () => {
    expect(classifyAdaptiveProfile({ memoryGb: 4, logicalCores: 4 })).toBe('lite');
    expect(classifyAdaptiveProfile({ memoryGb: 8, logicalCores: 4 })).toBe('standard');
    expect(classifyAdaptiveProfile({ memoryGb: 32, logicalCores: 12, localAiCapable: true })).toBe('performance');
  });
});
