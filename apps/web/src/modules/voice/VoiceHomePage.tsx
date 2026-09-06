import { Link } from 'react-router-dom';

export function VoiceHomePage() {
  return (
    <main className="atlas-page atlas-module-page voice-page">
      <p className="atlas-eyebrow">ATLAS Voice</p>
      <h1>ATLAS Voice</h1>
      <p className="atlas-page__lede">
        Governed voice capture, consent, quality validation and provider capability controls. No voice is represented as generated or ready without real provider evidence.
      </p>
      <div className="atlas-card-grid">
        <Link className="atlas-module-card" to="/voice/personal-voice">
          <strong>Personal Voice</strong>
          <span>Create and manage a user-owned ATLAS voice through consent, sound check, recording and provider verification.</span>
        </Link>
        <Link className="atlas-module-card" to="/voice/personal-voice/apple">
          <strong>Apple Personal Voice</strong>
          <span>Review the device-local Apple bridge capability and native-app requirement.</span>
        </Link>
      </div>
    </main>
  );
}
