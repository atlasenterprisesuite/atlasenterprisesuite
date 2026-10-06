import React, { useEffect, useRef, useState } from 'react';
import { atlasVoiceApi } from './voiceApi';

export function ElevenLabsNarration() {
  const [text, setText] = useState('The first move sets everything in motion.');
  const [state, setState] = useState('checking');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [audioUrl, setAudioUrl] = useState('');
  const audioRef = useRef('');
  const mounted = useRef(false);
  const controller = useRef<AbortController | null>(null);

  useEffect(() => {
    mounted.current = true;
    let cancelled = false;
    atlasVoiceApi.elevenLabsStatus().then((result) => {
      if (!cancelled) setState(result.state);
    }).catch((reason: Error) => {
      if (!cancelled) { setState('unavailable'); setError(reason.message); }
    });
    return () => {
      cancelled = true;
      mounted.current = false;
      controller.current?.abort();
      if (audioRef.current) URL.revokeObjectURL(audioRef.current);
    };
  }, []);

  async function generate() {
    if (busy || !text.trim() || text.trim().length > 1000 || state !== 'access_verified') return;
    setBusy(true);
    setError('');
    if (audioRef.current) URL.revokeObjectURL(audioRef.current);
    audioRef.current = '';
    setAudioUrl('');
    controller.current = new AbortController();
    try {
      const blob = await atlasVoiceApi.synthesizeElevenLabs(text.trim(), controller.current.signal);
      if (!mounted.current) return;
      const url = URL.createObjectURL(blob);
      audioRef.current = url;
      setAudioUrl(url);
    } catch (reason) {
      if (mounted.current) setError(reason instanceof Error ? reason.message : 'Audio generation failed');
    } finally {
      if (mounted.current) setBusy(false);
    }
  }

  return <section className="voice-narration" aria-labelledby="elevenlabs-heading">
    <h2 id="elevenlabs-heading">ElevenLabs narration</h2>
    <p>George · Multilingual v2 · AI-generated speech</p>
    <p role="status">{state === 'checking' ? 'Checking provider access…'
      : state === 'access_verified' ? 'Voice access verified. Speech is verified after successful generation.'
      : state === 'provider_not_configured' ? 'ElevenLabs requires a server API key.' : `Provider unavailable: ${state}`}</p>
    <label htmlFor="elevenlabs-text">Narration text</label>
    <textarea id="elevenlabs-text" value={text} maxLength={1000} rows={4}
      disabled={busy} onChange={(event) => setText(event.target.value)} />
    <small>{text.length}/1000 characters. Text is sent to ElevenLabs; generation uses provider credits.</small>
    <button type="button" disabled={busy || state !== 'access_verified' || !text.trim()} onClick={generate}>
      {busy ? 'Generating audio…' : 'Generate MP3'}
    </button>
    {error && <p role="alert">{error}</p>}
    {audioUrl && <div className="voice-narration-output">
      <p role="status">Audio generated successfully. AI-generated voice.</p>
      <audio controls src={audioUrl} aria-label="Generated narration" onError={() => setError('Audio playback failed. Try downloading the MP3.')} />
      <a href={audioUrl} download="atlas-narration.mp3">Download MP3</a>
    </div>}
  </section>;
}
