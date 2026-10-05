import { Link } from 'react-router-dom';
import { AtlasVoicePage } from './AtlasVoicePage';
import './voiceStudio.css';

export function VoiceStudioPage() {
  return (
    <section className="page-stack voice-studio-page voice-studio-production">
      <div className="voice-studio-utility-row">
        <Link className="voice-studio-utility-link" to="/voice/personal-voice">Personal Voice</Link>
      </div>

      <AtlasVoicePage embedded />

      <details className="voice-boundary-details voice-studio-boundaries">
        <summary>Provider & privacy boundaries</summary>
        <div>
          <p>External voice generation, telephony, streaming, export, and native Personal Voice control stay disabled until a real provider or supported native bridge is verified.</p>
          <p><strong>Requires ATLAS iOS app:</strong> Apple Personal Voice authorization and local playback are native-device capabilities; the web client never claims to export or control the Apple voice model.</p>
        </div>
      </details>
    </section>
  );
}
