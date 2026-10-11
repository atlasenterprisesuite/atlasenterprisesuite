import { describe, expect, it } from 'vitest';
import { analyzeLocalAudioPCM, buildLocalWaveform, estimateCamelotFromChroma } from '../../packages/creator/audio/local_analysis';

function clicks(bpm: number, seconds = 12, rate = 11025) {
  const samples = new Float32Array(seconds * rate);
  const step = rate * 60 / bpm;
  for (let pulse = 0; pulse * step < samples.length; pulse += 1) {
    const start = Math.round(pulse * step);
    for (let i = start; i < Math.min(samples.length, start + 180); i += 1) {
      samples[i] = 0.65 * Math.exp(-(i - start) / 35);
    }
  }
  return samples;
}

describe('ATLAS Audio DNA local analysis — reproducible estimates', () => {
  it('is fail-closed for empty or invalid PCM', () => {
    expect(() => analyzeLocalAudioPCM(new Float32Array(), 11025)).toThrow('audio_dna_invalid_pcm');
    expect(() => analyzeLocalAudioPCM(new Float32Array([Number.NaN]), 11025)).toThrow('audio_dna_non_finite_sample');
  });

  it('reports no key, tempo or false confidence for silence', () => {
    const result = analyzeLocalAudioPCM(new Float32Array(11025 * 6), 11025);
    expect(result.bpm).toBeNull();
    expect(result.camelot).toBeNull();
    expect(result.bpmConfidence).toBeNull();
    expect(result.keyConfidence).toBeNull();
    expect(result.peakDbfs).toBeNull();
    expect(result.energyPercent).toBe(0);
    expect(result.method).toBe('local-signal-estimate-v1');
  });

  it('estimates strong 120-BPM metronome transients within five BPM', () => {
    const result = analyzeLocalAudioPCM(clicks(120), 11025);
    expect(result.bpm).not.toBeNull();
    expect(Math.abs((result.bpm ?? 0) - 120)).toBeLessThanOrEqual(5);
    expect(result.onsetCount).toBeGreaterThan(8);
    expect(result.bpmConfidence).toBeGreaterThan(0);
  });

  it('estimates a second distinct 128-BPM metronome', () => {
    const result = analyzeLocalAudioPCM(clicks(128), 11025);
    expect(result.bpm).not.toBeNull();
    expect(Math.abs((result.bpm ?? 0) - 128)).toBeLessThanOrEqual(5);
  });

  it('recognizes a clean major-profile test input without requiring downloaded tracks', () => {
    const template = [6.35,2.23,3.48,2.33,4.38,4.09,2.52,5.19,2.39,3.66,2.29,2.88];
    const result = estimateCamelotFromChroma(template);
    expect(result.camelot).toBe('8B');
    expect(result.confidence).toBeGreaterThan(50);
  });

  it('derives a bounded waveform only from real PCM amplitude', () => {
    const signal = new Float32Array(80);
    signal.fill(0.25, 10, 20);
    signal.fill(0.8, 30, 40);
    const bins = buildLocalWaveform(signal, 8);
    expect(bins).toHaveLength(8);
    expect(bins[0]).toBe(0);
    expect(bins[1]).toBeGreaterThan(0);
    expect(bins[3]).toBe(1);
    expect(bins.every(value => value >= 0 && value <= 1)).toBe(true);
  });

  it('never paints fictional waveform amplitude for silence', () => {
    const result = analyzeLocalAudioPCM(new Float32Array(11025 * 6), 11025);
    expect(result.waveform).toHaveLength(64);
    expect(result.waveform.every(value => value === 0)).toBe(true);
    expect(() => buildLocalWaveform(new Float32Array([Number.NaN]), 8)).toThrow('audio_dna_non_finite_sample');
  });

  it('does not label ambiguous flat or invalid chroma as a real key', () => {
    expect(estimateCamelotFromChroma(new Array(12).fill(1)).camelot).toBeNull();
    expect(estimateCamelotFromChroma(new Array(12).fill(0)).camelot).toBeNull();
    expect(estimateCamelotFromChroma([Number.NaN, ...new Array(11).fill(1)]).camelot).toBeNull();
  });
});
