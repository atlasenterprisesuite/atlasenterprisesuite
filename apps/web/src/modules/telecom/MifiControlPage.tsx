import { useEffect, useMemo, useState } from 'react';
import { demoAtlasContext } from '../../../../../packages/core/src';
import {
  UnavailableMifiAdapter,
  normalizeNanpE164,
  type ForwardingReason,
  type MifiDevice
} from '../../../../../packages/telecom/src';

const adapter = new UnavailableMifiAdapter();
const deviceId = 'primary-mifi';
const unavailableNotice = 'No authorized MiFi device adapter is connected. ATLAS will not report carrier state until a real modem confirms it.';

export function MifiControlPage() {
  const [device, setDevice] = useState<MifiDevice | null>(null);
  const [displayName, setDisplayName] = useState('Primary MiFi');
  const [carrierName, setCarrierName] = useState('');
  const [lineNumber, setLineNumber] = useState('');
  const [destination, setDestination] = useState('');
  const [reason, setReason] = useState<ForwardingReason>('all');
  const [noAnswerSeconds, setNoAnswerSeconds] = useState(20);
  const [validationMessage, setValidationMessage] = useState('');

  useEffect(() => {
    adapter.getDevice(deviceId, demoAtlasContext.scope).then(setDevice);
  }, []);

  const canWrite = Boolean(device?.connectionState === 'connected' && device.capabilities.callForwarding);
  const capabilityEntries = useMemo(() => device ? [
    ['Call Forwarding', device.capabilities.callForwarding],
    ['SMS', device.capabilities.sms],
    ['USSD', device.capabilities.ussd],
    ['AT Commands', device.capabilities.atCommands],
    ['QMI', device.capabilities.qmi],
    ['MBIM', device.capabilities.mbim]
  ] as const : [], [device]);

  function validateDestination() {
    if (!destination.trim()) {
      setValidationMessage('Enter the destination number before activation.');
      return;
    }
    try {
      normalizeNanpE164(destination);
      setValidationMessage('');
    } catch (error) {
      setValidationMessage(error instanceof Error ? error.message : 'Invalid destination number.');
    }
  }

  return (
    <div className="page-stack mifi-page">
      <header className="page-header">
        <p className="eyebrow">Telecom / Devices / MiFi</p>
        <h1>MiFi Control</h1>
        <p>Configure the device locally and expose network controls only after an authorized modem adapter confirms support.</p>
      </header>

      <div className="notice strong" role="status">{unavailableNotice}</div>

      <section className="workspace-card mifi-config-card" aria-labelledby="mifi-device-heading">
        <div><p className="eyebrow">Device</p><h2 id="mifi-device-heading">Configuration</h2></div>
        <div className="mifi-form-grid">
          <label className="field"><span>Device name</span><input value={displayName} onChange={(event) => setDisplayName(event.target.value)} /></label>
          <label className="field"><span>Carrier</span><input value={carrierName} onChange={(event) => setCarrierName(event.target.value)} placeholder="Carrier label" /></label>
          <label className="field"><span>MiFi line</span><input value={lineNumber} onChange={(event) => setLineNumber(event.target.value)} inputMode="tel" placeholder="Phone number" /></label>
        </div>
        <div className="connection-gate"><strong>Adapter state</strong><span>{device?.connectionState ?? 'discovering'}</span></div>
      </section>

      <section className="workspace-card" aria-labelledby="mifi-capabilities-heading">
        <div><p className="eyebrow">Capabilities</p><h2 id="mifi-capabilities-heading">Modem controls</h2></div>
        <div className="capability-grid">
          {capabilityEntries.map(([label, supported]) => <article key={label}><span>{label}</span><strong>{supported ? 'Supported' : 'Unavailable'}</strong></article>)}
        </div>
      </section>

      <section className="workspace-card" aria-labelledby="mifi-forwarding-heading">
        <div><p className="eyebrow">Voice</p><h2 id="mifi-forwarding-heading">Call Forwarding</h2></div>
        <div className="mifi-form-grid">
          <label className="field"><span>Forward calls to</span><input value={destination} onChange={(event) => setDestination(event.target.value)} onBlur={validateDestination} inputMode="tel" aria-describedby="destination-message" /></label>
          <label className="field"><span>Forwarding mode</span><select value={reason} onChange={(event) => setReason(event.target.value as ForwardingReason)}><option value="all">All calls</option><option value="busy">When busy</option><option value="no-answer">No answer</option><option value="not-reachable">Not reachable</option></select></label>
          {reason === 'no-answer' && <label className="field"><span>No-answer delay</span><input type="number" min={5} max={30} value={noAnswerSeconds} onChange={(event) => setNoAnswerSeconds(Number(event.target.value))} /></label>}
        </div>
        <p id="destination-message" className="field-message" aria-live="polite">{validationMessage}</p>
        <div className="mifi-actions">
          <button disabled={!canWrite} onClick={validateDestination}>Activate forwarding</button>
          <button disabled={!canWrite}>Verify forwarding</button>
          <button disabled={!canWrite}>Disable forwarding</button>
        </div>
      </section>
    </div>
  );
}
