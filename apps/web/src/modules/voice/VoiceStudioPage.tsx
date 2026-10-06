import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { AtlasVoicePage } from './AtlasVoicePage';
import { ElevenLabsNarration } from './ElevenLabsNarration';
import { StudioPlayer } from './StudioPlayer';
import './voiceStudio.css';

const catalog = [
  { key: 'bienvenida', es: 'Bienvenida', en: 'Welcome', times: [13, 11], art: 'welcome', crop: '69 743 103 158' },
  { key: 'navegacion', es: 'Navegación', en: 'Navigation', times: [11, 10], art: 'navigation', crop: '567 743 103 158' },
  { key: 'ayuda', es: 'Ayuda', en: 'Help', times: [13, 11], art: 'help', crop: '1067 743 102 158' }
];

export function VoiceStudioPage() {
  const [lang, setLang] = useState<'es' | 'en'>('es');
  const es = lang === 'es';
  return <section className="voice-studio-page voice-studio-blueprint">
    <aside className="studio-navigation" aria-label="Voice Studio navigation">
      <Link to="/" className="studio-brand" aria-label="ATLAS home"><span className="studio-brand-symbol" aria-hidden="true">A</span><span>ATLAS</span></Link>
      <nav>
        <Link to="/">⌂ <span>{es ? 'Inicio' : 'Home'}</span></Link>
        <a href="#crear-audio" aria-label={es ? 'Crear audio' : 'Create audio'} className="is-active">≋ <span>{es ? 'Crear audio' : 'Create audio'}</span></a>
        <a href="#biblioteca-audio" aria-label={es ? 'Biblioteca' : 'Library'}>▱ <span>{es ? 'Biblioteca' : 'Library'}</span></a>
        <Link to="/voice/personal-voice" aria-label={es ? 'Voz personal' : 'Personal Voice'}>♙ <span>{es ? 'Voz personal' : 'Personal Voice'}</span></Link>
        <a href="#voice-assistant">◉ <span>{es ? 'Hablar con ATLAS' : 'Talk to ATLAS'}</span></a>
        <Link to="/settings/accessibility/communication">⚙ <span>{es ? 'Accesibilidad' : 'Accessibility'}</span></Link>
        <Link to="/suite">◇ <span>{es ? 'Todos los módulos' : 'All modules'}</span></Link>
      </nav>
    </aside>
    <div className="studio-content">
      <header className="studio-header"><div><h1>Voice Studio</h1><p>{es ? 'Tu voz. Tu universo.' : 'Your voice. Your universe.'}</p></div><div className="studio-header-actions"><div className="studio-language" aria-label="Interface language"><button type="button" aria-pressed={es} onClick={() => setLang('es')}>ES</button><span>/</span><button type="button" aria-pressed={!es} onClick={() => setLang('en')}>EN</button></div><Link to="/identity" className="studio-account"><span>A</span> ATLAS</Link></div></header>
      <ElevenLabsNarration lang={lang} onLanguageChange={setLang}/>
      <section className="studio-library" id="biblioteca-audio" aria-labelledby="studio-library-title"><h2 id="studio-library-title">{es ? 'Biblioteca de audio' : 'Audio library'}</h2><p>{es ? 'Bienvenida, navegación y ayuda' : 'Welcome, navigation and help'}</p><div className="studio-library-grid">{catalog.map(item => <article className="studio-audio-card" key={item.key}><div className={`studio-cover ${item.art}`} aria-hidden="true"><svg viewBox={item.crop}><image href="/assets/voice/studio-reference.png" width="1586" height="992"/></svg></div><div className="studio-card-content"><h3>{es ? item.es : item.en}</h3>{(['es','en'] as const).map((locale, i) => <div className="studio-track" key={locale}><span>{locale.toUpperCase()} · {item.times[i]} s</span><StudioPlayer compact src={`/assets/voice/${item.key}_${locale}.mp3`} title={`${es ? item.es : item.en} ${locale.toUpperCase()}`} lang={lang}/></div>)}</div></article>)}</div></section>
      <p className="studio-disclosure">✦ {es ? 'Voz generada con inteligencia artificial' : 'Voice generated with artificial intelligence'}</p>
      <section id="voice-assistant" className="studio-assistant"><AtlasVoicePage embedded/></section>
      <details className="voice-boundary-details"><summary>Provider & privacy boundaries</summary><div><p>ElevenLabs narration uses verified voice access and validates each generation.</p><p><strong>Requires ATLAS iOS app:</strong> Apple Personal Voice authorization and local playback are native-device capabilities; the web client never claims to export or control the Apple voice model.</p></div></details>
    </div>
  </section>;
}
