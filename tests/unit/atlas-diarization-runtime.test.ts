import { describe, expect, it } from 'vitest';
import {
  analyzeVoice,
  assignSpeakerForSession,
  parsePcm16Wav,
} from '../../apps/atlas-orchestrator/src/voice/diarization';

function sineWav(frequency: number, seconds = 1.2, sampleRate = 16000): Buffer {
  const frames = Math.floor(seconds * sampleRate);
  const buffer = Buffer.alloc(44 + frames * 2);
  buffer.write('RIFF', 0, 'ascii');
  buffer.writeUInt32LE(36 + frames * 2, 4);
  buffer.write('WAVE', 8, 'ascii');
  buffer.write('fmt ', 12, 'ascii');
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36, 'ascii');
  buffer.writeUInt32LE(frames * 2, 40);

  for (let index = 0; index < frames; index += 1) {
    const envelope = Math.min(1, index / 400, (frames - index) / 400);
    const sample = Math.sin((2 * Math.PI * frequency * index) / sampleRate) * 0.35 * Math.max(0, envelope);
    buffer.writeInt16LE(Math.round(sample * 32767), 44 + index * 2);
  }
  return buffer;
}

describe('ATLAS zero-cost acoustic diarization', () => {
  it('parses browser-compatible PCM16 WAV and extracts voiced features', () => {
    const parsed = parsePcm16Wav(sineWav(140));
    const analysis = analyzeVoice(parsed.samples, parsed.sampleRate);

    expect(parsed.sampleRate).toBe(16000);
    expect(parsed.durationMs).toBeGreaterThan(1000);
    expect(analysis.silent).toBe(false);
    expect(analysis.rms).toBeGreaterThan(0.1);
    expect(analysis.feature).toHaveLength(5);
  });

  it('forms two ephemeral speaker clusters and re-identifies the first acoustic profile', () => {
    const voiceA = parsePcm16Wav(sineWav(120));
    const voiceB = parsePcm16Wav(sineWav(240));
    const featureA = analyzeVoice(voiceA.samples, voiceA.sampleRate).feature;
    const featureB = analyzeVoice(voiceB.samples, voiceB.sampleRate).feature;
    const session = 'atlas-test-session-001';

    const first = assignSpeakerForSession(session, featureA, 1000);
    const second = assignSpeakerForSession(session, featureB, 2000);
    const third = assignSpeakerForSession(session, featureA, 3000);

    expect(first.speaker).toBe('speaker-a');
    expect(second.speaker).toBe('speaker-b');
    expect(third.speaker).toBe('speaker-a');
    expect(second.confidence).toBeGreaterThan(0.65);
  });

  it('rejects unsupported audio instead of guessing', () => {
    expect(() => parsePcm16Wav(Buffer.from('not-a-wave'))).toThrow('diarization_audio_invalid_wav');
  });
});
