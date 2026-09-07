import { Link } from 'react-router-dom';
import { appleWebCapabilities } from '../../../../../packages/voice/src';
import './voice.css';

const capabilityLabels: Record<keyof typeof appleWebCapabilities, string> = {
  localPlayback: 'Local playback',
  audioExport: 'Audio export',
  realtimeStream: 'Realtime stream',
  telephony: 'Telephony',
  serverSynthesis: 'Server synthesis'
};

export function AppleVoicePage() {
  return (
    <section className="page-stack voice-page">
      <header className="page-header">
        <p className="eyebrow">Personal Voice · Apple Bridge</p>
        <h1>Apple Personal Voice</h1>
        <p>Apple Personal Voice is a device-local capability. This web application cannot request or export it.</p>
      </header>

      <div className="voice-native-gate" role="status">
        <span className="voice-native-icon" aria-hidden="true">A</span>
        <div>
          <strong>Requires the ATLAS iOS app</strong>
          <p>A supported native ATLAS client must request Apple Personal Voice authorization on the device. No Apple voice data is uploaded from this web page.</p>
        </div>
      </div>

      <section className="voice-section" aria-labelledby="apple-capabilities-heading">
        <h2 id="apple-capabilities-heading">Web capability state</h2>
        <div className="voice-capability-list">
          {Object.entries(appleWebCapabilities).map(([key, supported]) => (
            <div key={key}>
              <span>{capabilityLabels[key as keyof typeof appleWebCapabilities]}</span>
              <strong>{supported ? 'Available' : 'Unavailable on web'}</strong>
            </div>
          ))}
        </div>
      </section>

      <Link className="text-link" to="/voice/personal-voice">Back to Personal Voice</Link>
    </section>
  );
}
