import { describe, expect, it } from 'vitest';
import { assessVoiceQuality } from '../../apps/web/src/modules/voice/quality';

describe('ATLAS Voice quality rules', () => {
  it('rejects clipping', () => {
    const result = assessVoiceQuality({
      peak: 0.999,
      rms: 0.25,
      silenceRatio: 0.1,
      noiseFloor: 0.02,
      volumeStdDev: 0.03
    });
    expect(result.status).toBe('needs_retry');
    expect(result.reasons).toContain('clipping');
  });

  it('accepts a stable sample', () => {
    const result = assessVoiceQuality({
      peak: 0.7,
      rms: 0.18,
      silenceRatio: 0.12,
      noiseFloor: 0.015,
      volumeStdDev: 0.04
    });
    expect(result.status).toBe('accepted');
  });
});
