import { describe, expect, it } from 'vitest';
import { normalizeBpm, normalizeCamelot, reorderMixTracks, transitionCompatibility } from '../../packages/creator/audio/mix';

const track = (id: string, bpm: number | null, camelot: string | null) => ({ id, title: id, bpm, camelot });

describe('ATLAS Local DJ deterministic playlist compatibility', () => {
  it('does not fabricate analysis when both metadata values are unknown', () => {
    const result = transitionCompatibility(track('a', null, null), track('b', null, null));
    expect(result.score).toBeNull();
    expect(result.reasons.join(' ')).toMatch(/unknown/i);
  });

  it('accepts valid Camelot circle values and normalizes only real BPM values', () => {
    expect(normalizeCamelot(' 12a ')).toBe('12A');
    expect(normalizeCamelot('13A')).toBeNull();
    expect(normalizeBpm(Number.NaN)).toBeNull();
    expect(normalizeBpm(0)).toBeNull();
    expect(normalizeBpm(127)).toBe(127);
  });

  it('recognizes same-key, neighboring key and relative major/minor connections', () => {
    const a = track('a', 120, '12A');
    expect(transitionCompatibility(a, track('b', 120, '12A')).harmony).toBe(100);
    expect(transitionCompatibility(a, track('c', 120, '1A')).harmony).toBe(88);
    expect(transitionCompatibility(a, track('d', 120, '12B')).harmony).toBe(92);
    expect(transitionCompatibility(a, track('e', 120, '6B')).harmony).toBe(0);
  });

  it('recognizes half-time/double-time without pretending it changed playback speed', () => {
    expect(transitionCompatibility(track('a', 120, null), track('b', 60, null)).tempo).toBe(100);
    expect(transitionCompatibility(track('a', 120, null), track('b', 240, null)).tempo).toBe(100);
  });

  it('suggests a stable next track using supplied metadata, keeping the first song', () => {
    const input = [track('first', 120, '8A'), track('bad', 160, '3B'), track('good', 121, '8B')];
    expect(reorderMixTracks(input).map(value => value.id)).toEqual(['first', 'good', 'bad']);
    expect(input[1].id).toBe('bad');
  });

  it('preserves original order if no metadata allows comparison', () => {
    const input = [track('a', null, null), track('b', null, null), track('c', null, null)];
    expect(reorderMixTracks(input).map(value => value.id)).toEqual(['a', 'b', 'c']);
  });
});
