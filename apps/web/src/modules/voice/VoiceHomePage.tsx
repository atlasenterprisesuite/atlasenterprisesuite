import { Link } from 'react-router-dom';

export function VoiceHomePage() {
  return (
    <section className="page-stack voice-page">
      <header className="page-header">
        <p className="eyebrow">ATLAS Voice</p>
        <h1>Universal voice control for ATLAS</h1>
        <p>Speak naturally, route safe navigation commands locally, and send conversational turns to the same governed ATLAS Intelligence backend used by Assistant.</p>
      </header>

      <div className="module-grid">
        <Link className="module-card enabled" to="/voice/assistant">
          <span>Conversation</span>
          <strong>Voice Assistant</strong>
          <p>Microphone → guarded transcript → ATLAS Intelligence → spoken response, with interruption and loop protection.</p>
        </Link>
        <Link className="module-card enabled" to="/voice/personal-voice">
          <span>Identity & speech</span>
          <strong>Personal Voice</strong>
          <p>Manage the existing governed Personal Voice workspace and verified platform capability boundaries.</p>
        </Link>
        <Link className="module-card enabled" to="/assistant">
          <span>Text + intelligence</span>
          <strong>Assistant Workspace</strong>
          <p>Open the full multi-provider intelligence workspace when a keyboard-first workflow is preferable.</p>
        </Link>
      </div>

      <div className="notice strong">
        Passive always-on wake-word listening is not claimed in the web client. “ATLAS” and “Hey ATLAS” are accepted as command prefixes after microphone activation; a true local wake word belongs in the native ATLAS device client.
      </div>

      <div className="voice-rules" aria-label="ATLAS Voice governance">
        <strong>Governed execution</strong>
        <span>Identity required</span>
        <span>tenant scoped</span>
        <span>verified AI provider only</span>
        <span>safe navigation actions local</span>
        <span>sensitive actions require approval</span>
      </div>
    </section>
  );
}
