import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import './atlas-welcome.css';

type WelcomeLanguage = 'es' | 'en';
type SpeechStatus = 'idle' | 'queued' | 'speaking' | 'unavailable' | 'error';

const COPY = {
  es: {
    eyebrow: 'ATLAS · Bienvenida inteligente',
    headline: 'Bienvenido a ATLAS',
    description: 'Muchas ideas, una plataforma. Tu espacio para trabajar, aprender, crear y conectar.',
    spoken: 'Soy ATLAS, tu asistente inteligente. Estoy aquí para ayudarte a organizar, crear y conectar tus ideas. ¿Qué te gustaría hacer hoy?',
    caption: 'Soy ATLAS, tu asistente inteligente. Estoy aquí para ayudarte a organizar, crear y conectar tus ideas. ¿Qué te gustaría hacer hoy?',
    play: 'Escuchar bienvenida',
    stop: 'Detener voz',
    skip: 'Omitir bienvenida',
    reopen: 'Mostrar bienvenida de ATLAS',
    modules: 'Explorar módulos',
    voice: 'Abrir ATLAS Voice',
    identity: 'Iniciar sesión',
    captionLabel: 'Subtítulos del saludo',
    queued: 'Preparando la voz del dispositivo…',
    speaking: 'Reproduciendo bienvenida',
    unavailable: 'La voz no está disponible en este navegador. El saludo permanece disponible por escrito.',
    error: 'No se pudo reproducir la voz. Puedes continuar leyendo el saludo.',
    language: 'Idioma de la bienvenida',
    helper: 'La voz requiere pulsar Escuchar. ATLAS no activa el micrófono durante la bienvenida.'
  },
  en: {
    eyebrow: 'ATLAS · Intelligent welcome',
    headline: 'Welcome to ATLAS',
    description: 'Many ideas, one platform. Your space to work, learn, create, and connect.',
    spoken: "I'm ATLAS, your intelligent assistant. I'm here to help you organize, create, and connect your ideas. What would you like to do today?",
    caption: "I'm ATLAS, your intelligent assistant. I'm here to help you organize, create, and connect your ideas. What would you like to do today?",
    play: 'Hear welcome',
    stop: 'Stop voice',
    skip: 'Skip welcome',
    reopen: 'Show ATLAS welcome',
    modules: 'Explore modules',
    voice: 'Open ATLAS Voice',
    identity: 'Sign in',
    captionLabel: 'Welcome captions',
    queued: 'Preparing device speech…',
    speaking: 'Playing welcome',
    unavailable: 'Speech is unavailable in this browser. The written welcome remains available.',
    error: 'Speech playback failed. You can continue reading the welcome.',
    language: 'Welcome language',
    helper: 'Audio starts only after you select Hear welcome. The microphone is never activated by this screen.'
  }
} as const;

const AVATAR_SRC = '/assets/atlas-voice-avatar-approved.webp';

export function AtlasWelcomeExperience() {
  const [language, setLanguage] = useState<WelcomeLanguage>('es');
  const [visible, setVisible] = useState(true);
  const [speechStatus, setSpeechStatus] = useState<SpeechStatus>('idle');
  const currentUtterance = useRef<SpeechSynthesisUtterance | null>(null);
  const t = COPY[language];

  useEffect(() => () => {
    if (currentUtterance.current && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      currentUtterance.current = null;
    }
  }, []);

  const stopSpeaking = () => {
    if (currentUtterance.current && 'speechSynthesis' in window) window.speechSynthesis.cancel();
    currentUtterance.current = null;
    setSpeechStatus('idle');
  };

  const chooseLanguage = (next: WelcomeLanguage) => {
    stopSpeaking();
    setLanguage(next);
  };

  const playWelcome = () => {
    if (!('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') {
      setSpeechStatus('unavailable');
      return;
    }
    stopSpeaking();
    const utterance = new SpeechSynthesisUtterance(t.headline + '. ' + t.spoken);
    utterance.lang = language === 'es' ? 'es-ES' : 'en-US';
    utterance.rate = 0.96;
    utterance.onstart = () => {
      if (currentUtterance.current === utterance) setSpeechStatus('speaking');
    };
    utterance.onend = () => {
      if (currentUtterance.current === utterance) {
        currentUtterance.current = null;
        setSpeechStatus('idle');
      }
    };
    utterance.onerror = () => {
      if (currentUtterance.current === utterance) {
        currentUtterance.current = null;
        setSpeechStatus('error');
      }
    };
    currentUtterance.current = utterance;
    setSpeechStatus('queued');
    try {
      window.speechSynthesis.speak(utterance);
    } catch {
      currentUtterance.current = null;
      setSpeechStatus('error');
    }
  };

  if (!visible) {
    return (
      <div className="atlas-welcome-reopen">
        <button type="button" onClick={() => setVisible(true)}>{t.reopen}</button>
      </div>
    );
  }

  return (
    <section className="atlas-welcome" aria-label={t.eyebrow} lang={language}>
      <div className="atlas-welcome-visual" aria-hidden="true">
        <div className="atlas-welcome-orbit" />
        <img src={AVATAR_SRC} alt="" draggable={false} width="320" height="320" />
        <span className="atlas-welcome-avatar-label">ATLAS AI</span>
      </div>
      <div className="atlas-welcome-content">
        <div className="atlas-welcome-topline">
          <p>{t.eyebrow}</p>
          <div className="atlas-welcome-languages" role="group" aria-label={t.language}>
            <button type="button" aria-pressed={language === 'es'} onClick={() => chooseLanguage('es')}>ES</button>
            <button type="button" aria-pressed={language === 'en'} onClick={() => chooseLanguage('en')}>EN</button>
          </div>
        </div>
        <h2>{t.headline}</h2>
        <p className="atlas-welcome-description">{t.description}</p>
        <div className="atlas-welcome-caption" aria-label={t.captionLabel}>
          <span className="atlas-welcome-waveform" aria-hidden="true">▂ ▆ ▃ █ ▄ ▆ ▂</span>
          <p>{t.caption}</p>
        </div>
        <div className="atlas-welcome-actions">
          {speechStatus === 'queued' || speechStatus === 'speaking'
            ? <button className="atlas-welcome-primary" type="button" onClick={stopSpeaking}>{t.stop}</button>
            : <button className="atlas-welcome-primary" type="button" onClick={playWelcome}>{t.play}</button>}
          <Link to="/suite">{t.modules}</Link>
          <Link to="/studio/voice">{t.voice}</Link>
          <Link to="/identity">{t.identity}</Link>
        </div>
        <p className="atlas-welcome-feedback" role="status" aria-live="polite">
          {speechStatus === 'queued' ? t.queued
            : speechStatus === 'speaking' ? t.speaking
              : speechStatus === 'unavailable' ? t.unavailable
                : speechStatus === 'error' ? t.error
                  : t.helper}
        </p>
        <button className="atlas-welcome-skip" type="button" onClick={() => {
          stopSpeaking();
          setVisible(false);
        }}>{t.skip}</button>
      </div>
    </section>
  );
}
