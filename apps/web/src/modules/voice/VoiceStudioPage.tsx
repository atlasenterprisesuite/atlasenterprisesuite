import { Link } from 'react-router-dom';
import { AtlasVoicePage } from './AtlasVoicePage';
import './voiceStudio.css';

export function VoiceStudioPage() {
  return (
    <section className="page-stack voice-studio-page">
      <header className="voice-studio-header">
        <div>
          <p className="eyebrow">ATLAS Voice</p>
          <h1>Voice Studio</h1>
          <p>One focused place to speak with ATLAS, review what it heard, and manage Personal Voice without exposing provider complexity in the primary experience.</p>
        </div>
        <Link className="voice-studio-personal-link" to="/voice/personal-voice">Personal Voice</Link>
      </header>

      <div className="voice-capability-strip" aria-label="Voice capability status">
        <span><i className="is-live" aria-hidden="true" />Identity protected</span>
        <span><i className="is-live" aria-hidden="true" />Browser voice available when supported</span>
        <span><i className="is-gated" aria-hidden="true" />Apple bridge native-only</span>
      </div>

      <details className="voice-boundary-details">
        <summary>Provider & privacy boundaries</summary>
        <div>
          <p>External voice generation, telephony, streaming, export, and native Personal Voice control stay disabled until a real provider or supported native bridge is verified.</p>
          <p><strong>Requires ATLAS iOS app:</strong> Apple Personal Voice authorization and local playback are native-device capabilities; the web client never claims to export or control the Apple voice model.</p>
        </div>
      </details>

      <AtlasVoicePage embedded />

      <Link className="text-link voice-studio-home-link" to="/">Return to ATLAS home</Link>
    </section>
  );
}
