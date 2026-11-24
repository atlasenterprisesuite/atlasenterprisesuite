import { describe, expect, it } from 'vitest';
import {
  cueAtTime, parseTimedCaptions, searchCaptions,
  serializeTimedCaptions, validateTimedCaptions
} from '../../packages/creator/captions';

const sampleSrt = [
  '1',
  '00:00:01,000 --> 00:00:03,500',
  'Stay until sunrise.',
  '',
  '2',
  '00:00:04,000 --> 00:00:06,000',
  'Mañana trae nuevas preguntas.',
  ''
].join('\n');

describe('ATLAS Cinematic Transcript Studio · fail-closed timed captions', () => {
  it('parses timestamped SRT accurately and navigates at exact boundaries', () => {
    const cues = parseTimedCaptions(sampleSrt);
    expect(cues).toHaveLength(2);
    expect(cues[0]).toMatchObject({ start: 1, end: 3.5, text: 'Stay until sunrise.' });
    expect(cueAtTime(cues, 3.499)?.id).toBe(cues[0].id);
    expect(cueAtTime(cues, 3.5)).toBeNull();
    expect(cueAtTime(cues, 4)?.id).toBe(cues[1].id);
    expect(cueAtTime(cues, -1)).toBeNull();
  });

  it('imports WEBVTT with a cue ID and optional positioning, retaining lines as literal text', () => {
    const cues = parseTimedCaptions('WEBVTT\n\nintro\n00:00:01.100 --> 00:00:02.800 align:start\nFirst line\nSecond line\n');
    expect(cues).toHaveLength(1);
    expect(cues[0]).toMatchObject({ start: 1.1, end: 2.8, text: 'First line\nSecond line' });
  });

  it('serializes both formats with millisecond fidelity and round trips', () => {
    const cues = parseTimedCaptions(sampleSrt);
    const vtt = serializeTimedCaptions(cues, 'vtt');
    const srt = serializeTimedCaptions(cues, 'srt');
    expect(vtt).toMatch(/^WEBVTT\n\n/);
    expect(vtt).toContain('00:00:03.500');
    expect(srt).toContain('00:00:03,500');
    expect(parseTimedCaptions(vtt).map(({start, end, text}) => ({start, end, text})))
      .toEqual(cues.map(({start, end, text}) => ({start, end, text})));
  });

  it('finds multilingual transcript phrases without altering timestamps', () => {
    const cues = parseTimedCaptions(sampleSrt);
    expect(searchCaptions(cues, 'MANANA').map(cue => cue.start)).toEqual([4]);
    expect(searchCaptions(cues, 'sunrise').map(cue => cue.start)).toEqual([1]);
    expect(searchCaptions(cues, '')).toEqual(cues);
  });

  it('rejects overlapping, missing, invalid, maliciously large and non-finite timing data', () => {
    expect(() => parseTimedCaptions('1\n00:00:01,000 --> 00:00:04,000\nA\n\n2\n00:00:03,000 --> 00:00:05,000\nB')).toThrow();
    expect(() => parseTimedCaptions('WEBVTT\n\n00:00:62.000 --> 00:01:03.000\nInvalid seconds')).toThrow();
    expect(() => parseTimedCaptions('WEBVTT\n\n00:00:02.000 --> 00:00:01.000\nBackwards')).toThrow();
    expect(() => parseTimedCaptions('not a timestamped transcript')).toThrow();
    expect(() => parseTimedCaptions('x'.repeat(2_000_001))).toThrow();
    const invalid = [{ id: 'a', start: Number.NaN, end: 2, text: 'Text' }];
    expect(validateTimedCaptions(invalid)).not.toEqual([]);
    expect(() => serializeTimedCaptions(invalid, 'srt')).toThrow();
  });

  it('will not serialize blank or out-of-duration cues', () => {
    expect(validateTimedCaptions([{id: 'a', start: 0, end: 4, text: ' '}])).not.toEqual([]);
    const cues = parseTimedCaptions(sampleSrt);
    expect(validateTimedCaptions(cues, 5)).not.toEqual([]);
    expect(validateTimedCaptions(cues, 10)).toEqual([]);
  });

  it('treats subtitle content as literal untrusted text, not commands or HTML', () => {
    const data = 'WEBVTT\n\n00:00:01.000 --> 00:00:02.000\n<img src=x onerror=alert(1)>';
    const cues = parseTimedCaptions(data);
    expect(cues[0].text).toBe('<img src=x onerror=alert(1)>');
    expect(serializeTimedCaptions(cues, 'vtt')).toContain('<img src=x onerror=alert(1)>');
  });
});
