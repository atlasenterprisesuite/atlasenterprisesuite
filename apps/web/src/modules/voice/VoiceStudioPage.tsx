import { Link } from 'react-router-dom';
import { AtlasVoicePage } from './AtlasVoicePage';
import { ElevenLabsNarration } from './ElevenLabsNarration';
import './voiceStudio.css';

const visuallyHiddenHeadingStyle = {
  position: 'absolute' as const,
  width: '1px',
  height: '1px',
  padding: 0,
  margin: '-1px',
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap' as const,
  border: 0
};

export function VoiceStudioPage() {
  return (
    <section className="page-stack voice-studio-page voice-studio-production">
      <h1 style={visuallyHiddenHeadingStyle}>Voice Studio</h1>

      <div className="voice-studio-utility-row">
        <Link className="voice-studio-utility-link" to="/voice/personal-voice">Personal Voice</Link>
      </div>

      <AtlasVoicePage embedded />
      <ElevenLabsNarration />

      <details className="voice-boundary-details voice-studio-boundaries">
        <summary>Provider & privacy boundaries</summary>
        <div>
          <p>ElevenLabs narration uses verified voice access and validates each generation. Other external voice capabilities require their own verified provider or supported native bridge.</p>
          <p><strong>Requires ATLAS iOS app:</strong> Apple Personal Voice authorization and local playback are native-device capabilities; the web client never claims to export or control the Apple voice model.</p>
        </div>
      </details>
    </section>
  );
}
