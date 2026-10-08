import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { crossfadeGains, formatDjTime, normalizeDjLevel } from './djMath';
import './dj.css';

type DeckId = 'A' | 'B';

function DjDeck({ id, gain, master }: { id: DeckId; gain: number; master: number }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const [url, setUrl] = useState('');
  const [trackName, setTrackName] = useState('');
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);
  const [level, setLevel] = useState(1);
  const [error, setError] = useState('');

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = normalizeDjLevel(level * gain * master);
  }, [gain, level, master, url]);

  useEffect(() => () => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
  }, []);

  function loadFile(file?: File) {
    if (!file) return;
    if (file.type && !file.type.startsWith('audio/')) {
      setError('Select a supported local audio file.');
      return;
    }
    audioRef.current?.pause();
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const nextUrl = URL.createObjectURL(file);
    objectUrlRef.current = nextUrl;
    setUrl(nextUrl);
    setTrackName(file.name);
    setPlaying(false);
    setDuration(0);
    setPosition(0);
    setError('');
  }

  async function togglePlay() {
    const audio = audioRef.current;
    if (!audio || !url) return;
    if (!audio.paused) {
      audio.pause();
      return;
    }
    try {
      await audio.play();
      setError('');
    } catch {
      setPlaying(false);
      setError('Playback was blocked or this audio format is unsupported.');
    }
  }

  function cue() {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
    setPosition(0);
  }

  function seek(seconds: number) {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(duration) || duration <= 0) return;
    audio.currentTime = Math.max(0, Math.min(seconds, duration));
    setPosition(audio.currentTime);
  }

  return (
    <section className="atlas-dj-deck" aria-label={`Deck ${id}`}>
      <div className="atlas-dj-deck-heading"><span className="atlas-dj-deck-id">DECK {id}</span><span className="atlas-dj-live-state">{playing ? 'Playing' : url ? 'Ready' : 'Empty'}</span></div>
      <h2 title={trackName || undefined}>{trackName || 'Load an audio track'}</h2>
      <p className="atlas-dj-time" aria-live="off">{formatDjTime(position)} <span>/ {formatDjTime(duration || Number.NaN)}</span></p>
      <input aria-label={`Seek deck ${id}`} className="atlas-dj-seek" type="range" min="0" max={duration > 0 ? duration : 1} step="0.1" value={Math.min(position, duration || 1)} onChange={event => seek(Number(event.target.value))} disabled={!url || duration <= 0} />
      <div className="atlas-dj-actions">
        <label className="atlas-dj-file-button">
          Load audio
          <input type="file" accept="audio/*" aria-label={`Load audio into deck ${id}`} onChange={event => { loadFile(event.target.files?.[0]); event.target.value = ''; }} />
        </label>
        <button type="button" disabled={!url} onClick={() => void togglePlay()}>{playing ? 'Pause' : 'Play'}</button>
        <button type="button" disabled={!url} onClick={cue}>Cue / Reset</button>
      </div>
      <div className="atlas-dj-level">
        <label htmlFor={`dj-level-${id}`}>Deck level</label>
        <input id={`dj-level-${id}`} type="range" min="0" max="1" step="0.01" value={level} onChange={event => setLevel(Number(event.target.value))} />
        <output>{Math.round(level * 100)}%</output>
      </div>
      {error && <p className="atlas-dj-error" role="alert">{error}</p>}
      <audio key={url} ref={audioRef} src={url || undefined} preload="metadata"
        onLoadedMetadata={event => { const seconds = event.currentTarget.duration; setDuration(Number.isFinite(seconds) ? seconds : 0); }}
        onTimeUpdate={event => setPosition(event.currentTarget.currentTime)}
        onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onError={() => { if (url) setError('This browser could not decode the selected audio file.'); }} />
    </section>
  );
}

export function AtlasDjPage() {
  const [crossfade, setCrossfade] = useState(0);
  const [master, setMaster] = useState(0.8);
  const gains = crossfadeGains(crossfade);

  return (
    <main className="atlas-dj-page">
      <nav className="atlas-dj-breadcrumb" aria-label="Breadcrumb"><Link to="/studio">ATLAS Studio</Link><span>/</span><span>DJ Universe</span></nav>
      <header className="atlas-dj-hero">
        <p className="eyebrow">ATLAS Studio · DJ Universe</p>
        <h1>Two decks. One performance.</h1>
        <p>Mix two local audio tracks in your browser. No upload, paid engine, external service or fabricated hardware connection.</p>
        <span className="atlas-dj-badge">Local two-deck mixer · MVP</span>
      </header>
      <div className="atlas-dj-decks">
        <DjDeck id="A" gain={gains.a} master={master} />
        <DjDeck id="B" gain={gains.b} master={master} />
      </div>
      <section className="atlas-dj-mixer" aria-label="Mixer">
        <h2>Master mixer</h2>
        <div className="atlas-dj-crossfade">
          <label htmlFor="atlas-dj-crossfade">Crossfader</label>
          <div className="atlas-dj-crossfade-labels"><span>DECK A</span><span>CENTER</span><span>DECK B</span></div>
          <input id="atlas-dj-crossfade" type="range" min="-1" max="1" step="0.01" value={crossfade} onChange={event => setCrossfade(Number(event.target.value))} />
          <button type="button" onClick={() => setCrossfade(0)}>Center crossfader</button>
        </div>
        <div className="atlas-dj-level">
          <label htmlFor="atlas-dj-master">Master level</label>
          <input id="atlas-dj-master" type="range" min="0" max="1" step="0.01" value={master} onChange={event => setMaster(Number(event.target.value))} />
          <output>{Math.round(master * 100)}%</output>
        </div>
        <p className="atlas-dj-disclaimer">Equal-power volume crossfade is active. Beatmatching, tempo adjustment, cue monitoring, DVS, MIDI/HID, stems, recording and streaming are not implemented. Audio playback requires a supported browser format and user interaction.</p>
        <Link to="/studio/create?type=music">Continue to Music Lab →</Link>
      </section>
    </main>
  );
}
