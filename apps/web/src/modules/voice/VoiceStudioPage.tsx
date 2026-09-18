import { Link } from 'react-router-dom';
import { AtlasVoicePage } from './AtlasVoicePage';
import './voiceStudio.css';

export function VoiceStudioPage() {
  return (
    <section className="page-stack">
      <header className="page-header">
        <p className="eyebrow">ATLAS Studio</p>
        <h1>ATLAS Voice Studio</h1>
        <p>Identity-gated voice workspace with capability states that reflect only verified platform support.</p>
      </header>

      <div className="module-grid">
        <article className="module-card enabled atlas-voice-assistant-card">
          <img src="/atlas/assistant/atlas-assistant-avatar.png" alt="" />
          <div>
            <span>Assistant</span>
            <strong>ATLAS Assistant</strong>
            <p>The same authenticated assistant identity used across ATLAS. Provider, microphone, speech, and streaming states remain governed by verified runtime capabilities.</p>
          </div>
        </article>
        <article className="module-card enabled">
          <span>Access</span>
          <strong>ATLAS Identity verified</strong>
          <p>This route requires an authenticated Supabase session and an active ATLAS organization membership.</p>
        </article>
        <article className="module-card disabled" aria-disabled="true">
          <span>Apple Personal Voice</span>
          <strong>Requires ATLAS iOS app</strong>
          <p>The web application does not claim access to Apple-native Personal Voice APIs. Native playback must be verified on a supported physical Apple device.</p>
        </article>
      </div>

      <div className="notice strong">
        External voice generation, telephony, streaming, export, and native Personal Voice control are not represented as connected until a real provider or supported native bridge is verified. Browser microphone recognition and guarded browser TTS remain available where the browser exposes those APIs.
      </div>

      <AtlasVoicePage embedded />

      <Link className="text-link" to="/">Return to ATLAS home</Link>
    </section>
  );
}
