import { Link } from 'react-router-dom';
import './voice.css';

export function PersonalVoicePage() {
  return (
    <section className="page-stack voice-page">
      <header className="page-header">
        <p className="eyebrow">ATLAS Voice</p>
        <h1>Personal Voice</h1>
        <p>Create a governed ATLAS voice or connect an authorized Apple Personal Voice on a supported native ATLAS client.</p>
      </header>

      <div className="voice-hero-grid">
        <Link className="voice-card voice-card-primary" to="/voice/personal-voice/setup">
          <span className="voice-card-kicker">ATLAS Personal Voice</span>
          <strong>Create my ATLAS Voice</strong>
          <p>Consent, microphone setup, guided recording, quality review and provider-gated generation.</p>
          <span className="action-link">Get started</span>
        </Link>
        <Link className="voice-card" to="/voice/personal-voice/apple">
          <span className="voice-card-kicker">Apple bridge</span>
          <strong>Apple Personal Voice</strong>
          <p>Check the native-device requirement and authorization boundary.</p>
          <span className="action-link">Check availability</span>
        </Link>
      </div>

      <section className="voice-section" aria-labelledby="my-voices-heading">
        <div className="voice-section-heading">
          <div><p className="eyebrow">Library</p><h2 id="my-voices-heading">My Voices</h2></div>
          <Link className="text-link" to="/voice/personal-voice/permissions">Permissions</Link>
        </div>
        <div className="empty-state">
          <strong>No generated ATLAS voices in this session</strong>
          <span>A voice will appear here only after a real generation provider returns a verified result.</span>
        </div>
      </section>
    </section>
  );
}
