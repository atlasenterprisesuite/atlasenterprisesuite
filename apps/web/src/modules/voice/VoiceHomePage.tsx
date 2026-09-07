import { Link } from 'react-router-dom';
import './voice.css';

export function VoiceHomePage() {
  return (
    <section className="page-stack voice-page">
      <header className="page-header">
        <p className="eyebrow">ATLAS Voice</p>
        <h1>ATLAS Voice</h1>
        <p>Governed speech, personal voice, transcription, calls and assistant capabilities with explicit provider and permission boundaries.</p>
      </header>
      <div className="voice-hero-grid">
        <Link className="voice-card voice-card-primary" to="/voice/personal-voice">
          <span className="voice-card-kicker">Personal Voice</span>
          <strong>Create or connect your voice</strong>
          <p>Record an ATLAS voice with consent and quality checks, or review Apple Personal Voice availability.</p>
          <span className="action-link">Open Personal Voice</span>
        </Link>
        <div className="voice-card" aria-disabled="true">
          <span className="voice-card-kicker">Voice Assistant</span>
          <strong>Provider-gated</strong>
          <p>Assistant voice use becomes available only after an authorized voice provider and permission scope exist.</p>
        </div>
      </div>
    </section>
  );
}
