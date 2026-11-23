/**
 * ATLAS Music / local neuroacoustic sound sketches.
 * Offline Web Audio synthesis only: no copyrighted recordings, provider calls,
 * clinical effectiveness claims, cloud persistence, or hidden playback.
 */
export type SoundCategory = 'binaural' | 'ambient' | 'nature' | 'reference-tone';
export type NatureSource = 'rain' | 'ocean' | 'wind';

export type NeuroacousticPreset = {
  id: string;
  title: string;
  category: SoundCategory;
  description: string;
  beatHz?: number;
  toneHz?: number;
  nature?: NatureSource;
  notes?: readonly number[];
};

export const NEUROACOUSTIC_PRESETS: readonly NeuroacousticPreset[] = [
  { id: 'delta-2', title: 'Delta · 2 Hz', category: 'binaural', description: 'Slow perceived binaural pulse; a sound experiment, not a sleep treatment.', beatHz: 2 },
  { id: 'theta-7', title: 'Theta · 7 Hz', category: 'binaural', description: 'Slow perceived binaural pulse for a quiet listening session.', beatHz: 7 },
  { id: 'alpha-10', title: 'Alpha · 10 Hz', category: 'binaural', description: 'Perceived 10 Hz binaural pulse for a concentration experiment.', beatHz: 10 },
  { id: 'gamma-40', title: 'Gamma · 40 Hz', category: 'binaural', description: 'Faster perceived binaural pulse; no cognitive benefit is guaranteed.', beatHz: 40 },
  { id: 'ambient-pad', title: 'Ambient synth pad', category: 'ambient', description: 'Original, sustained instrumental tones for background listening.', notes: [174.61, 220, 261.63] },
  { id: 'ambient-drone', title: 'Ambient deep drone', category: 'ambient', description: 'Original low-key harmonic drone without lyrics.', notes: [130.81, 196, 261.63] },
  { id: 'rain', title: 'Soft rain', category: 'nature', description: 'Locally synthesized rain-like noise, not a field recording.', nature: 'rain' },
  { id: 'ocean', title: 'Ocean-like wash', category: 'nature', description: 'Locally synthesized ocean-like noise, not a real recording.', nature: 'ocean' },
  { id: 'wind', title: 'Gentle wind', category: 'nature', description: 'Locally synthesized wind-like noise.', nature: 'wind' },
  { id: 'tone-432', title: '432 Hz reference tone', category: 'reference-tone', description: 'Single audible tone; not equivalent to tuning an entire composition to A4 = 432 Hz.', toneHz: 432 },
  { id: 'tone-528', title: '528 Hz reference tone', category: 'reference-tone', description: 'Single audible tone; no DNA-repair or medical effect is implied.', toneHz: 528 }
];

export type SoundPlan =
  | { kind: 'binaural'; leftHz: number; rightHz: number; beatHz: number; gain: number; requiresHeadphones: true }
  | { kind: 'ambient'; notes: readonly number[]; gain: number; requiresHeadphones: false }
  | { kind: 'nature'; nature: NatureSource; gain: number; requiresHeadphones: false }
  | { kind: 'tone'; toneHz: number; gain: number; requiresHeadphones: false };

export function makeSoundPlan(preset: NeuroacousticPreset): SoundPlan {
  switch (preset.category) {
    case 'binaural': {
      const beatHz = preset.beatHz;
      if (beatHz === undefined || !Number.isFinite(beatHz) || beatHz < 1 || beatHz > 40) throw new Error('invalid_binaural_pulse');
      return { kind: 'binaural', leftHz: 180, rightHz: 180 + beatHz, beatHz, gain: 0.045, requiresHeadphones: true };
    }
    case 'ambient': {
      if (!preset.notes?.length || !preset.notes.every(n => Number.isFinite(n) && n >= 80 && n <= 1000)) throw new Error('invalid_ambient_notes');
      return { kind: 'ambient', notes: preset.notes, gain: 0.026, requiresHeadphones: false };
    }
    case 'nature':
      if (!preset.nature || !['rain', 'ocean', 'wind'].includes(preset.nature)) throw new Error('invalid_nature_source');
      return { kind: 'nature', nature: preset.nature, gain: 0.045, requiresHeadphones: false };
    case 'reference-tone':
      if (!preset.toneHz || !Number.isFinite(preset.toneHz) || preset.toneHz < 80 || preset.toneHz > 1000) throw new Error('invalid_reference_tone');
      return { kind: 'tone', toneHz: preset.toneHz, gain: 0.025, requiresHeadphones: false };
    default:
      throw new Error('unsupported_sound_category');
  }
}

export type LocalSoundSession = { stop: () => void };

/** A user gesture must create/resume the context in the caller before playback. */
export function createLocalSoundSession(context: AudioContext, preset: NeuroacousticPreset): LocalSoundSession {
  const plan = makeSoundPlan(preset);
  const master = context.createGain();
  master.gain.value = plan.gain;
  master.connect(context.destination);
  const sources: AudioScheduledSourceNode[] = [];
  const nodes: AudioNode[] = [master];

  function oscillator(hz: number): OscillatorNode {
    const node = context.createOscillator();
    node.type = 'sine';
    node.frequency.value = hz;
    sources.push(node);
    nodes.push(node);
    return node;
  }

  try {
    if (plan.kind === 'binaural') {
      const merger = context.createChannelMerger(2);
      nodes.push(merger);
      const left = oscillator(plan.leftHz);
      const right = oscillator(plan.rightHz);
      left.connect(merger, 0, 0);
      right.connect(merger, 0, 1);
      merger.connect(master);
    } else if (plan.kind === 'ambient') {
      for (const hz of plan.notes) oscillator(hz).connect(master);
    } else if (plan.kind === 'tone') {
      oscillator(plan.toneHz).connect(master);
    } else {
      // Generated signal only. A short loop is filtered into a nature-like texture.
      const length = Math.max(1, Math.floor(context.sampleRate * 3));
      const buffer = context.createBuffer(1, length, context.sampleRate);
      const samples = buffer.getChannelData(0);
      let brown = 0;
      for (let i = 0; i < samples.length; i++) {
        const white = Math.random() * 2 - 1;
        brown = (brown + white * 0.025) / 1.025;
        samples[i] = Math.max(-1, Math.min(1, plan.nature === 'rain' ? white * 0.7 + brown * 0.3 : brown * 3));
      }
      const noise = context.createBufferSource();
      noise.buffer = buffer;
      noise.loop = true;
      const filter = context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = plan.nature === 'rain' ? 2100 : plan.nature === 'wind' ? 800 : 420;
      noise.connect(filter);
      filter.connect(master);
      sources.push(noise);
      nodes.push(noise, filter);
    }
    for (const source of sources) source.start();
  } catch (error) {
    for (const source of sources) {
      try { source.stop(); } catch { /* A source may not have started. */ }
    }
    for (const node of nodes) node.disconnect();
    throw error;
  }

  let stopped = false;
  return {
    stop() {
      if (stopped) return;
      stopped = true;
      for (const source of sources) {
        try { source.stop(); } catch { /* Already stopped. */ }
      }
      for (const node of nodes) node.disconnect();
    }
  };
}
