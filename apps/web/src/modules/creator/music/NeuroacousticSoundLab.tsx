import { useEffect, useRef, useState } from 'react';
import {
  MUSIC_STYLE_REFERENCES,
  NEUROACOUSTIC_PRESETS,
  createLocalSoundSession,
  makeSoundPlan,
  type LocalSoundSession,
  type SoundCategory
} from '../../../../../../packages/creator/audio/neuroacoustic';
import './neuroacoustic-sound-lab.css';

const CATEGORIES: { id: SoundCategory; label: string }[] = [
  { id: 'binaural', label: 'Binaural pulses' },
  { id: 'ambient', label: 'Ambient music' },
  { id: 'nature', label: 'Nature-inspired' },
  { id: 'reference-tone', label: 'Reference tones' }
];

export function NeuroacousticSoundLab() {
  const [category, setCategory] = useState<SoundCategory>('binaural');
  const [selectedId, setSelectedId] = useState('alpha-10');
  const [durationMinutes, setDurationMinutes] = useState(5);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [message, setMessage] = useState('Choose a sound and press Play. No audio starts automatically.');
  const contextRef = useRef<AudioContext | null>(null);
  const sessionRef = useRef<LocalSoundSession | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const generationRef = useRef(0);
  const aliveRef = useRef(true);

  function releaseAudio() {
    generationRef.current += 1;
    if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
    sessionRef.current?.stop();
    sessionRef.current = null;
    const previous = contextRef.current;
    contextRef.current = null;
    if (previous) void previous.close().catch(() => { /* Disposed locally. */ });
  }

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      releaseAudio();
    };
  }, []);

  const selected = NEUROACOUSTIC_PRESETS.find(item => item.id === selectedId) ?? NEUROACOUSTIC_PRESETS[0];
  const options = NEUROACOUSTIC_PRESETS.filter(item => item.category === category);
  const plan = makeSoundPlan(selected);

  function stop(note = 'Playback stopped. All local audio nodes released.') {
    releaseAudio();
    setPlayingId(null);
    setMessage(note);
  }

  function changeCategory(next: SoundCategory) {
    stop('Category changed. No audio is playing.');
    setCategory(next);
    const first = NEUROACOUSTIC_PRESETS.find(item => item.category === next);
    if (first) setSelectedId(first.id);
  }

  function changePreset(id: string) {
    stop('Sound selected. Press Play to listen.');
    setSelectedId(id);
  }

  async function play() {
    stop('Starting local audio…');
    const token = generationRef.current;
    const Constructor = window.AudioContext;
    if (!Constructor) {
      setMessage('This browser does not support Web Audio. No sound was started.');
      return;
    }
    const context = new Constructor();
    contextRef.current = context;
    try {
      sessionRef.current = createLocalSoundSession(context, selected);
      await context.resume();
      if (!aliveRef.current || generationRef.current !== token) return;
      setPlayingId(selected.id);
      setMessage('Playing locally. Use Stop at any time; playback ends automatically.');
      timeoutRef.current = setTimeout(() => {
        if (!aliveRef.current || generationRef.current !== token) return;
        stop('Session timer finished. Audio stopped.');
      }, durationMinutes * 60_000);
    } catch {
      if (aliveRef.current && generationRef.current === token) {
        stop('Playback was blocked or unavailable. Check your browser audio settings.');
      }
    }
  }

  return <section className="atlas-sound-lab atlas-dj-panel" aria-labelledby="atlas-sound-title">
    <header>
      <p className="eyebrow">ATLAS Music Universe 777 · Browser-local</p>
      <h2 id="atlas-sound-title">Neuroacoustic Sound Lab</h2>
      <p>Explore original synthesized soundscapes, binaural pulses and reference tones. These are audio experiments, not medical treatments or guaranteed changes in brain activity.</p>
    </header>
    <div className="atlas-sound-controls">
      <label htmlFor="atlas-sound-category">Audio category</label>
      <select id="atlas-sound-category" value={category} onChange={event => changeCategory(event.target.value as SoundCategory)}>
        {CATEGORIES.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
      </select>
    </div>
    <div className="atlas-sound-options" role="group" aria-label="Choose sound">
      {options.map(item => <button key={item.id} type="button" aria-pressed={item.id === selectedId}
        className={item.id === selectedId ? 'selected' : ''}
        onClick={() => changePreset(item.id)}>
        <strong>{item.title}</strong><span>{item.description}</span>
      </button>)}
    </div>
    <div className="atlas-sound-selected">
      <strong>{selected.title}</strong>
      <span>{plan.kind === 'binaural'
        ? `Left ${plan.leftHz} Hz / right ${plan.rightHz} Hz — perceived difference ${plan.beatHz} Hz (stereo headphones needed)`
        : plan.kind === 'tone'
          ? `Single audible ${plan.toneHz} Hz tone — not a health intervention`
          : plan.kind === 'ambient' ? 'Original synthesized ambient instrumental' : 'Generated noise texture; not a nature field recording'}</span>
    </div>
    <div className="atlas-sound-actions">
      <label htmlFor="atlas-sound-duration">Session timer</label>
      <select id="atlas-sound-duration" value={durationMinutes} disabled={Boolean(playingId)} onChange={event => setDurationMinutes(Number(event.target.value))}>
        {[5, 10, 20, 30].map(minutes => <option key={minutes} value={minutes}>{minutes} minutes</option>)}
      </select>
      <button type="button" onClick={() => void play()} disabled={playingId === selected.id}>Play selected sound</button>
      <button type="button" onClick={() => stop()} disabled={!playingId && !contextRef.current}>Stop</button>
    </div>
    <p className="atlas-sound-status" role="status" aria-live="polite">{message}</p>
    <section className="atlas-sound-references" aria-labelledby="atlas-sound-reference-title">
      <h3 id="atlas-sound-reference-title">Music styles and listening references</h3>
      <p>Examples for discovery and future rights-cleared playlists. No copyrighted songs are included or marked as binaural recordings.</p>
      <ul>{MUSIC_STYLE_REFERENCES.map(item => <li key={item.example}><strong>{item.label}</strong><span>{item.example}</span><small>Reference only · Audio not hosted</small></li>)}</ul>
    </section>
    <p className="atlas-dj-disclaimer">Keep the volume low, especially with headphones. Binaural pulses require separate left/right channels; do not drive or perform safety-critical tasks while experimenting. Stop if sound causes discomfort. No external audio, account, tracking, uploads or paid provider is used. Music examples such as Marconi Union, Brian Eno and Alan Walker are references only; their copyrighted recordings are not included.</p>
  </section>;
}
