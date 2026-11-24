import { describe, expect, it } from 'vitest';
import { composeSonic, renderSonicWav } from '../../packages/creator/audio/sonic_engine';

describe('SONIC Engine 777', () => {
  const spec = { bpm: 120, bars: 2, root: 60, seed: 777 };
  it('creates a bounded, deterministic multi-voice score', () => {
    const score = composeSonic(spec);
    expect(score).toEqual(composeSonic(spec));
    expect(score).not.toEqual(composeSonic({ ...spec, seed: 778 }));
    expect(new Set(score.notes.map(n => n.voice)).size).toBe(3);
    expect(score.duration).toBe(4);
    expect(score.notes.every(n => n.start >= 0 && n.start + n.duration <= score.duration)).toBe(true);
  });
  it('rejects invalid and nonfinite settings', () => {
    for (const patch of [{ bpm: NaN }, { bars: 100 }, { root: 200 }, { seed: Infinity }, { bars: 1.5 }]) {
      expect(() => composeSonic({ ...spec, ...patch })).toThrow();
    }
  });
  it('renders actual bounded non-silent PCM with valid RIFF size', () => {
    const wav = renderSonicWav(composeSonic(spec));
    const v = new DataView(wav.buffer);
    expect(String.fromCharCode(...wav.slice(0,4))).toBe('RIFF');
    expect(String.fromCharCode(...wav.slice(8,12))).toBe('WAVE');
    expect(v.getUint32(4,true)).toBe(wav.length-8);
    expect(v.getUint32(40,true)).toBe(wav.length-44);
    expect(v.getUint32(24,true)).toBe(22050);
    expect(wav.length).toBe(44+4*22050*2);
    const pcm = Array.from({length:(wav.length-44)/2}, (_,i) => v.getInt16(44+i*2,true));
    expect(pcm.some(n => n !== 0)).toBe(true);
    expect(pcm.every(n => Math.abs(n) <= 16384)).toBe(true);
  });
  it('rejects invalid externally supplied score instead of allocating unbounded buffers', () => {
    const score = composeSonic(spec);
    expect(() => renderSonicWav({ ...score, duration: Infinity })).toThrow();
    expect(() => renderSonicWav({ ...score, notes: [{ ...score.notes[0], midi: NaN }] })).toThrow();
  });
});
