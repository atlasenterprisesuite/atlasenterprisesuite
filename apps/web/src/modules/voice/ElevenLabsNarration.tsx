import React, { useEffect, useRef, useState } from 'react';
import { atlasVoiceApi } from './voiceApi';
import { StudioPlayer } from './StudioPlayer';

export function ElevenLabsNarration({ lang = 'en', onLanguageChange }: { lang?: 'es' | 'en'; onLanguageChange?: (lang: 'es' | 'en') => void }) {
  const [text, setText] = useState(lang === 'es' ? 'Bienvenido a ATLAS Enterprise Suite. Tu espacio para organizar, crear y trabajar.' : 'The first move sets everything in motion.');
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

  const es = lang === 'es';
  return <section className="studio-workspace" id="crear-audio" aria-labelledby="elevenlabs-heading">
    <div className="studio-voice-stage">
      <div className={busy ? 'studio-wave-scene is-generating' : 'studio-wave-scene'}><svg className="studio-reference-art" viewBox="241 160 710 308" aria-hidden="true"><image href="/assets/voice/studio-reference.png" width="1586" height="992"/></svg></div>
      <div className="studio-stage-caption"><h2 id="elevenlabs-heading">George</h2><p>{es ? 'Voz sintética' : 'Synthetic voice'} · ElevenLabs</p></div>
      <StudioPlayer src={audioUrl || `/assets/voice/bienvenida_${lang}.mp3`} title={audioUrl ? 'Generated narration' : (es ? 'Bienvenida' : 'Welcome')} lang={lang}/>
    </div>
    <div className="studio-editor">
      <div className="studio-editor-heading"><label htmlFor="elevenlabs-text">{es ? 'Guion' : 'Script'}</label><span>{text.length} / 1000</span></div>
      <textarea aria-label="Narration text" id="elevenlabs-text" value={text} maxLength={1000} rows={6} disabled={busy} onChange={event => setText(event.target.value)}/>
      <div className="studio-field-row"><label>{es ? 'Idioma de la interfaz' : 'Interface language'}<select className="studio-choice" value={lang} onChange={event => onLanguageChange?.(event.target.value as 'es' | 'en')} disabled={!onLanguageChange}><option value="es">Español</option><option value="en">English</option></select></label><label>{es ? 'Voz' : 'Voice'}<span className="studio-choice">≋ George <small>Multilingual v2</small></span></label></div>
      <button className="studio-generate" type="button" aria-label={busy ? 'Generating audio…' : 'Generate MP3'} disabled={busy || state !== 'access_verified' || !text.trim()} onClick={generate}>{busy ? (es ? 'Generando audio…' : 'Generating audio…') : (es ? '≋ Generar audio →' : '≋ Generate audio →')}</button>
      <small className="studio-credit-note">{es ? 'El guion se envía a ElevenLabs y utiliza créditos de tu cuenta.' : 'Text is sent to ElevenLabs; generation uses provider credits.'}</small>
      <p className={`studio-provider-state ${state === 'access_verified' ? 'is-ready' : ''}`} role="status">{state === 'checking' ? 'Checking provider access…' : state === 'access_verified' ? 'Voice access verified. Speech is verified after successful generation.' : state === 'provider_not_configured' ? 'ElevenLabs requires a server API key.' : `Provider unavailable: ${state}`}</p>
      {error && <p className="studio-error" role="alert">{error}</p>}
      {audioUrl && <p className="studio-success" role="status">Audio generated successfully. AI-generated voice.</p>}
    </div>
  </section>;
}
