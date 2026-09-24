import { describe, expect, it } from 'vitest';
import { assessVoiceQuality } from '../../apps/web/src/modules/voice/quality';

describe('ATLAS Personal Voice quality gates', () => {
  it('rejects clipping and accepts a stable sample', () => {
    expect(assessVoiceQuality({
      peak: 0.999,
      rms: 0.25,
      silenceRatio: 0.1,
      noiseFloor: 0.02,
      volumeStdDev: 0.03
    })).toMatchObject({ status: 'needs_retry', reasons: expect.arrayContaining(['clipping']) });

    expect(assessVoiceQuality({
      peak: 0.7,
      rms: 0.18,
      silenceRatio: 0.12,
      noiseFloor: 0.015,
      volumeStdDev: 0.04
    })).toEqual({ status: 'accepted', reasons: [] });
  });
});
