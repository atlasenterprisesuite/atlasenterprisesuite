import { describe, expect, it, vi } from 'vitest';
import { MUSIC_STYLE_REFERENCES, NEUROACOUSTIC_PRESETS, createLocalSoundSession, makeSoundPlan } from '../../packages/creator/audio/neuroacoustic';

const preset = (id: string) => {
  const found = NEUROACOUSTIC_PRESETS.find(item => item.id === id);
  if (!found) throw new Error('missing test preset: ' + id);
  return found;
};

function fakeAudioContext() {
  const oscillators: Array<{ frequency: { value: number }; start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn> }> = [];
  const sources: Array<{ start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn>; loop: boolean }> = [];
  const gain = { gain: { value: 0, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() }, connect: vi.fn(), disconnect: vi.fn() };
  const context = {
    currentTime: 0, sampleRate: 44100, destination: {},
    createGain: vi.fn(() => gain),
    createOscillator: vi.fn(() => {
      const osc = { frequency: { value: 0 }, type: 'sine', connect: vi.fn(), start: vi.fn(), stop: vi.fn(), disconnect: vi.fn() };
      oscillators.push(osc);
      return osc;
    }),
    createChannelMerger: vi.fn(() => ({ connect: vi.fn(), disconnect: vi.fn() })),
    createBuffer: vi.fn(() => ({ getChannelData: () => new Float32Array(1024) })),
    createBufferSource: vi.fn(() => {
      const source = { buffer: null, loop: false, connect: vi.fn(), start: vi.fn(), stop: vi.fn(), disconnect: vi.fn() };
      sources.push(source);
      return source;
    }),
    createBiquadFilter: vi.fn(() => ({ type: 'lowpass', frequency: { value: 0 }, connect: vi.fn(), disconnect: vi.fn() }))
  };
  return { context: context as unknown as AudioContext, contextMock: context, oscillators, sources, gain };
}

describe('ATLAS Music — local neuroacoustic catalog and synthesis', () => {
  it('offers distinct binaural, ambient, nature and reference-tone categories without external music files', () => {
    expect(new Set(NEUROACOUSTIC_PRESETS.map(item => item.id)).size).toBe(NEUROACOUSTIC_PRESETS.length);
    expect(new Set(NEUROACOUSTIC_PRESETS.map(item => item.category))).toEqual(new Set(['binaural', 'ambient', 'nature', 'reference-tone']));
    expect(NEUROACOUSTIC_PRESETS.map(item => item.id)).toEqual(expect.arrayContaining(['delta-2', 'theta-7', 'alpha-10', 'gamma-40', 'rain', 'ocean', 'wind', 'tone-432', 'tone-528']));
  });

  it('classifies music listening references without bundling or mislabeling copyrighted songs as binaural', () => {
    expect(MUSIC_STYLE_REFERENCES.map(item => item.style)).toEqual(expect.arrayContaining(['ambient', 'chillout', 'melodic-electronic']));
    expect(MUSIC_STYLE_REFERENCES.map(item => item.example)).toEqual(expect.arrayContaining(['Weightless — Marconi Union', 'Ambient 1: Music for Airports — Brian Eno', 'Faded (Instrumental) — Alan Walker']));
    expect(MUSIC_STYLE_REFERENCES.every(item => item.playbackAvailable === false && item.isBinauralCertified === false)).toBe(true);
  });

  it('uses separate actual audible carriers for binaural perception; 10 Hz is not emitted as an audible tone', () => {
    const plan = makeSoundPlan(preset('alpha-10'));
    expect(plan.kind).toBe('binaural');
    expect(plan.leftHz).toBe(180);
    expect(plan.rightHz).toBe(190);
    expect(plan.beatHz).toBe(10);
    expect(plan.requiresHeadphones).toBe(true);
    expect(plan.gain).toBeLessThanOrEqual(0.06);
  });

  it('does not label reference tones or nature sounds as binaural beats', () => {
    expect(makeSoundPlan(preset('tone-528'))).toMatchObject({ kind: 'tone', toneHz: 528, requiresHeadphones: false });
    expect(makeSoundPlan(preset('rain'))).toMatchObject({ kind: 'nature', requiresHeadphones: false });
  });

  it('creates stereo oscillators and stops both sources and releases its graph', () => {
    const stub = fakeAudioContext();
    const session = createLocalSoundSession(stub.context, preset('theta-7'));
    expect(stub.oscillators.map(item => item.frequency.value)).toEqual([180, 187]);
    expect(stub.contextMock.createChannelMerger).toHaveBeenCalledWith(2);
    expect(stub.oscillators.every(item => item.start.mock.calls.length === 1)).toBe(true);
    session.stop();
    session.stop();
    expect(stub.oscillators.every(item => item.stop.mock.calls.length === 1)).toBe(true);
    expect(stub.gain.disconnect).toHaveBeenCalledTimes(1);
  });

  it('generates nature noise inside the browser without network, external audio or permissions', () => {
    const stub = fakeAudioContext();
    const session = createLocalSoundSession(stub.context, preset('ocean'));
    expect(stub.contextMock.createBuffer).toHaveBeenCalledTimes(1);
    expect(stub.sources).toHaveLength(1);
    expect(stub.sources[0].loop).toBe(true);
    expect(stub.sources[0].start).toHaveBeenCalledTimes(1);
    session.stop();
    expect(stub.sources[0].stop).toHaveBeenCalledTimes(1);
  });
});
