import React, { useEffect, useRef, useState } from 'react';
import { atlasVoiceApi } from './voiceApi';
import { StudioPlayer } from './StudioPlayer';

export function AtlasVoiceNarration({
  lang = 'en',
  onLanguageChange
}: {
  lang?: 'es' | 'en';
  onLanguageChange?: (lang: 'es' | 'en') => void;
}) {
  const [text, setText] = useState(
    lang === 'es'
      ? 'Bienvenido a ATLAS Enterprise Suite. Tu espacio para organizar, crear y trabajar.'
      : 'The first move sets everything in motion.'
  );
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
      if (!cancelled) {
        setState('unavailable');
        setError(reason.message);
      }
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
  const providerState = state === 'checking'
    ? (es ? 'Verificando motor de voz…' : 'Checking voice engine…')
    : state === 'access_verified'
      ? (es ? 'Motor de voz verificado. Cada síntesis se valida al completarse.' : 'Voice engine verified. Each synthesis is validated on completion.')
      : state === 'provider_not_configured'
        ? (es ? 'El motor externo de voz requiere configuración de servidor.' : 'The external voice engine requires server configuration.')
        : (es ? `Motor de voz no disponible: ${state}` : `Voice engine unavailable: ${state}`);

  return (
    <section className="studio-workspace" id="crear-audio" aria-labelledby="atlas-voice-narration-heading">
      <div className="studio-voice-stage">
        <div className={busy ? 'studio-wave-scene is-generating' : 'studio-wave-scene'}>
          <svg className="studio-reference-art" viewBox="241 160 710 308" aria-hidden="true">
            <image href="/assets/voice/studio-reference.png" width="1586" height="992"/>
          </svg>
        </div>
        <div className="studio-stage-caption">
          <h2 id="atlas-voice-narration-heading">ATLAS Voice Narrator</h2>
          <p>{es ? 'Narración neural multilingüe' : 'Multilingual neural narration'}</p>
        </div>
        <StudioPlayer
          src={audioUrl || `/assets/voice/bienvenida_${lang}.mp3`}
          title={audioUrl ? 'Generated narration' : (es ? 'Bienvenida' : 'Welcome')}
          lang={lang}
        />
      </div>

      <div className="studio-editor">
        <div className="studio-editor-heading">
          <label htmlFor="atlas-voice-narration-text">{es ? 'Guion' : 'Script'}</label>
          <span>{text.length} / 1000</span>
        </div>
        <textarea
          aria-label="Narration text"
          id="atlas-voice-narration-text"
          value={text}
          maxLength={1000}
          rows={6}
          disabled={busy}
          onChange={(event) => setText(event.target.value)}
        />

        <div className="studio-field-row">
          <label>
            {es ? 'Idioma de la interfaz' : 'Interface language'}
            <select
              className="studio-choice"
              value={lang}
              onChange={(event) => onLanguageChange?.(event.target.value as 'es' | 'en')}
              disabled={!onLanguageChange}
            >
              <option value="es">Español</option>
              <option value="en">English</option>
            </select>
          </label>
          <label>
            {es ? 'Perfil' : 'Profile'}
            <span className="studio-choice">≋ ATLAS Neural <small>Multilingual</small></span>
          </label>
        </div>

        <button
          className="studio-generate"
          type="button"
          aria-label={es ? (busy ? 'Generando audio…' : 'Generar MP3') : (busy ? 'Generating audio…' : 'Generate MP3')}
          disabled={busy || state !== 'access_verified' || !text.trim()}
          onClick={generate}
        >
          {busy ? (es ? 'Generando audio…' : 'Generating audio…') : (es ? '≋ Generar audio →' : '≋ Generate audio →')}
        </button>

        <small className="studio-credit-note">
          {es
            ? 'La narración usa el adaptador de voz autorizado de ATLAS; el proveedor puede consumir créditos cuando corresponde.'
            : 'Narration uses the authorized ATLAS voice adapter; the provider may consume credits when applicable.'}
        </small>
        <p className={`studio-provider-state ${state === 'access_verified' ? 'is-ready' : ''}`} role="status">
          {providerState}
        </p>
        <details className="voice-boundary-details">
          <summary>{es ? 'Motor y privacidad' : 'Engine & privacy'}</summary>
          <div>
            <p>
              {es
                ? 'Motor externo actual: ElevenLabs. ATLAS mantiene la identidad de producto y el contrato de voz independientes del proveedor.'
                : 'Current external engine: ElevenLabs. ATLAS keeps product identity and the voice contract provider-independent.'}
            </p>
          </div>
        </details>
        {error && <p className="studio-error" role="alert">{error}</p>}
        {audioUrl && <p className="studio-success" role="status">Audio generated successfully. AI-generated voice.</p>}
      </div>
    </section>
  );
}
