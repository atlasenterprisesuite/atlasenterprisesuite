import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { CAMELOT_KEYS, normalizeBpm, reorderMixTracks, transitionCompatibility, type MixTrackMetadata } from '../../../../../../packages/creator/audio/mix';
import './local-dj-mix.css';

type LocalTrack = MixTrackMetadata & { file: File; url: string };
type PlayState = 'idle' | 'playing' | 'blocked';

class LocalCrossfadeSession {
  private active = false;
  private tickTimer: ReturnType<typeof setInterval> | null = null;
  private current: HTMLAudioElement | null = null;
  private incoming: HTMLAudioElement | null = null;
  private fadeStart = 0;
  private starting = false;
  private index = 0;

  constructor(
    private readonly tracks: LocalTrack[],
    private readonly fadeSeconds: number,
    private readonly report: (index: number, status: PlayState, message: string) => void
  ) {}

  async start() {
    this.stop();
    if (!this.tracks.length) return;
    this.active = true;
    const initial = new Audio(this.tracks[0].url);
    initial.preload = 'auto';
    this.current = initial;
    try {
      await initial.play();
      if (!this.active) { initial.pause(); return; }
      this.report(0, 'playing', 'Playing from local files. Audio stays in this browser.');
      this.tickTimer = setInterval(() => this.tick(), 100);
    } catch {
      this.stop();
      this.report(0, 'blocked', 'Browser could not play this file. Try a supported audio format.');
    }
  }

  async next() {
    if (!this.active || this.incoming || this.starting || this.index >= this.tracks.length - 1) return;
    this.starting = true;
    const target = new Audio(this.tracks[this.index + 1].url);
    target.preload = 'auto';
    target.volume = 0;
    try {
      await target.play();
      if (!this.active) { target.pause(); return; }
      this.incoming = target;
      this.fadeStart = performance.now();
      this.report(this.index, 'playing', 'Crossfading between local tracks.');
    } catch {
      target.pause();
      if (this.active) {
        this.stop();
        this.report(this.index, 'blocked', 'Next track could not play. Mix stopped without skipping tracks.');
      }
    } finally {
      this.starting = false;
    }
  }

  private tick() {
    if (!this.active || !this.current) return;
    if (this.incoming) {
      const progress = Math.min(1, (performance.now() - this.fadeStart) / (this.fadeSeconds * 1000));
      this.current.volume = Math.cos(progress * Math.PI / 2);
      this.incoming.volume = Math.sin(progress * Math.PI / 2);
      if (progress >= 1) {
        this.current.pause();
        this.current = this.incoming;
        this.incoming = null;
        this.index += 1;
        this.report(this.index, 'playing', 'Playing from local files. Audio stays in this browser.');
      }
      return;
    }
    if (this.index === this.tracks.length - 1 && this.current.ended) {
      this.stop();
      this.report(this.index, 'idle', 'Local mix finished.');
      return;
    }
    if (this.index < this.tracks.length - 1 &&
      (this.current.ended || (Number.isFinite(this.current.duration) && this.current.duration > 0 &&
        this.current.duration - this.current.currentTime <= this.fadeSeconds))) {
      void this.next();
    }
  }

  stop() {
    this.active = false;
    if (this.tickTimer) clearInterval(this.tickTimer);
    this.tickTimer = null;
    this.current?.pause();
    this.incoming?.pause();
    this.current = null;
    this.incoming = null;
    this.starting = false;
    this.index = 0;
  }
}

export function LocalDJMixPage() {
  const [tracks, setTracks] = useState<LocalTrack[]>([]);
  const [fadeSeconds, setFadeSeconds] = useState(6);
  const [status, setStatus] = useState<PlayState>('idle');
  const [activeIndex, setActiveIndex] = useState(0);
  const [message, setMessage] = useState('Add local audio tracks to begin.');
  const sessionRef = useRef<LocalCrossfadeSession | null>(null);
  const tracksRef = useRef<LocalTrack[]>([]);
  tracksRef.current = tracks;

  useEffect(() => () => {
    sessionRef.current?.stop();
    tracksRef.current.forEach(track => URL.revokeObjectURL(track.url));
  }, []);

  function halt(note = 'Playback stopped.') {
    sessionRef.current?.stop();
    sessionRef.current = null;
    setActiveIndex(0);
    setStatus('idle');
    setMessage(note);
  }

  function importFiles(files: FileList | null) {
    if (!files?.length) return;
    const allowed = [...files].filter(file =>
      (file.type.startsWith('audio/') || /\.(mp3|m4a|aac|wav|ogg|flac)$/i.test(file.name)) &&
      file.size > 0 && file.size <= 100 * 1024 * 1024
    );
    const slots = Math.max(0, 24 - tracks.length);
    const accepted = allowed.slice(0, slots).map(file => ({
      id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
      title: file.name.replace(/\.[^.]+$/, ''),
      file,
      url: URL.createObjectURL(file),
      bpm: null,
      camelot: null
    }));
    if (accepted.length) {
      halt('Local tracks imported. Enter BPM/keys to enable informed reordering.');
      setTracks(previous => [...previous, ...accepted]);
    } else setMessage('No supported non-empty files within the 100 MB / 24-track limit were added.');
    if (accepted.length < files.length) setMessage('Some files were skipped (format, size, or 24-track limit).');
  }

  function updateTrack(id: string, patch: Partial<MixTrackMetadata>) {
    halt('Track metadata updated. Ready to preview.');
    setTracks(previous => previous.map(track => track.id === id ? { ...track, ...patch } : track));
  }

  function removeTrack(id: string) {
    halt();
    const toRemove = tracks.find(track => track.id === id);
    if (toRemove) URL.revokeObjectURL(toRemove.url);
    setTracks(previous => previous.filter(track => track.id !== id));
  }

  function smartReorder() {
    halt();
    const ordered = reorderMixTracks(tracks);
    setTracks(ordered);
    const informed = ordered.slice(1).some((track, index) => transitionCompatibility(ordered[index], track).score !== null);
    setMessage(informed ? 'Track order suggested using entered BPM/Camelot metadata. Audio was not analyzed.' :
      'Not reordered by musical compatibility: enter BPM or Camelot keys first.');
  }

  async function start() {
    if (!tracks.length) return;
    halt();
    const session = new LocalCrossfadeSession(tracks, fadeSeconds, (index, nextStatus, note) => {
      setActiveIndex(index);
      setStatus(nextStatus);
      setMessage(note);
    });
    sessionRef.current = session;
    await session.start();
  }

  const current = tracks[activeIndex];
  return <section className="creator-page atlas-dj-page" aria-label="ATLAS Local DJ Mixer">
    <nav className="creator-breadcrumb" aria-label="Breadcrumb"><Link to="/studio">ATLAS Studio</Link><span>/</span><Link to="/studio/create?type=music">Music Lab</Link><span>/</span><span>Local DJ</span></nav>
    <header className="atlas-dj-header">
      <p className="eyebrow">ATLAS Audio Platform · Local preview</p>
      <h1>ATLAS Local DJ</h1>
      <p>Mix tracks from your own device. Equal-power crossfades play locally; no Spotify audio is accessed, uploaded or copied.</p>
      <span className="atlas-dj-chip">Browser-local · No provider required</span>
    </header>
    <div className="atlas-dj-panel">
      <label className="atlas-dj-upload">
        <span>Add audio files (up to 24, 100 MB each)</span>
        <input aria-label="Add audio files" type="file" accept="audio/*,.m4a,.mp3,.wav,.ogg,.flac" multiple onChange={event => {
          importFiles(event.target.files);
          event.target.value = '';
        }} />
      </label>
      <div className="atlas-dj-decks" aria-label="Mix decks">
        <div><small>Deck A · Now playing</small><strong>{current?.title || 'No track loaded'}</strong><span>{current?.bpm ? `${current.bpm} BPM` : 'BPM not provided'} · {current?.camelot || 'Key unknown'}</span></div>
        <div><small>Deck B · Up next</small><strong>{tracks[activeIndex + 1]?.title || 'No next track'}</strong><span>Automatic crossfade</span></div>
      </div>
      <div className="atlas-dj-controls">
        <label>Crossfade duration: <strong>{fadeSeconds}s</strong>
          <input type="range" aria-label="Crossfade duration" min="2" max="12" step="1" value={fadeSeconds} disabled={status === 'playing'} onChange={event => setFadeSeconds(Number(event.target.value))} />
        </label>
        <div className="atlas-dj-buttons">
          <button type="button" onClick={() => void start()} disabled={!tracks.length}>Play mix</button>
          <button type="button" onClick={() => void sessionRef.current?.next()} disabled={status !== 'playing' || activeIndex >= tracks.length - 1}>Next mix</button>
          <button type="button" onClick={() => halt()} disabled={status !== 'playing'}>Stop</button>
          <button type="button" onClick={smartReorder} disabled={tracks.length < 3}>Smart reorder</button>
        </div>
      </div>
      <p role="status" className={status === 'blocked' ? 'atlas-dj-error' : 'atlas-dj-status'}>{message}</p>
    </div>
    <div className="atlas-dj-panel">
      <h2>Playlist · {tracks.length} tracks</h2>
      {tracks.length === 0 ? <p>Add your own licensed or authorized files. BPM and Camelot codes are optional, user-entered values; analysis is not yet automatic.</p> : <ol className="atlas-dj-list">
        {tracks.map((track, index) => {
          const compatibility = index ? transitionCompatibility(tracks[index - 1], track) : null;
          return <li key={track.id}>
            <div className="atlas-dj-track"><strong>{index + 1}. {track.title}</strong>{compatibility && <span>{compatibility.score === null ? 'Compatibility unavailable' : `Compatibility ${compatibility.score}/100 (estimate)`}</span>}</div>
            <label>BPM<input aria-label={`BPM for ${track.title}`} type="number" min="40" max="250" placeholder="Unknown" value={track.bpm ?? ''} onChange={event => updateTrack(track.id, { bpm: event.target.value ? normalizeBpm(Number(event.target.value)) : null })} /></label>
            <label>Key<select aria-label={`Camelot key for ${track.title}`} value={track.camelot || ''} onChange={event => updateTrack(track.id, { camelot: event.target.value || null })}><option value="">Unknown</option>{CAMELOT_KEYS.map(key => <option key={key} value={key}>{key}</option>)}</select></label>
            <button type="button" onClick={() => removeTrack(track.id)} aria-label={`Remove ${track.title}`}>Remove</button>
          </li>;
        })}
      </ol>}
    </div>
    <p className="atlas-dj-disclaimer">Private, temporary playback only. Files never leave this page. No audio export, recording, cloud persistence, license validation, automatic beat detection, beat synchronization or mastering is claimed. Do not use copyrighted files for public or commercial distribution without appropriate rights.</p>
  </section>;
}
