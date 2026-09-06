import { describe, expect, it } from 'vitest';
import { assessVoiceQuality } from '../../apps/web/src/modules/voice/quality';

describe('ATLAS Voice quality assessment', () => {
  it('rejects clipping', () => {
    const result = assessVoiceQuality({
      peak: 0.999,
      rms: 0.25,
      silenceRatio: 0.1,
      noiseFloor: 0.02,
      volumeStdDev: 0.03,
    });
    expect(result.status).toBe('needs_retry');
    expect(result.reasons).toContain('clipping');
  });

  it('rejects weak or mostly silent audio', () => {
    const result = assessVoiceQuality({
      peak: 0.2,
      rms: 0.02,
      silenceRatio: 0.7,
      noiseFloor: 0.01,
      volumeStdDev: 0.02,
    });
    expect(result.status).toBe('needs_retry');
    expect(result.reasons).toContain('low_volume');
    expect(result.reasons).toContain('excessive_silence');
  });

  it('accepts a stable sample', () => {
    expect(assessVoiceQuality({
      peak: 0.7,
      rms: 0.18,
      silenceRatio: 0.12,
      noiseFloor: 0.015,
      volumeStdDev: 0.04,
    })).toEqual({ status: 'accepted', reasons: [] });
  });
});
