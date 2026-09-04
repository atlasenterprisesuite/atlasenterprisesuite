import { useEffect, useMemo, useState } from 'react';
import { demoAtlasContext } from '../../../../../packages/core/src';
import {
  TelecomError,
  UnavailableMifiAdapter,
  normalizeNanpE164,
  rulesMatch,
  validateForwardingRequest,
  type CallForwardingRule,
  type ForwardingReason,
  type MifiAdapter,
  type MifiDevice,
  type OperationState
} from '../../../../../packages/telecom/src';

const defaultAdapter = new UnavailableMifiAdapter();
const deviceId = 'primary-mifi';
const unavailableNotice = 'No authorized MiFi device adapter is connected. ATLAS will not report carrier state until a real modem confirms it.';

type MifiControlPageProps = {
  adapter?: MifiAdapter;
  writeAuthorized?: boolean;
};

export function MifiControlPage({ adapter = defaultAdapter, writeAuthorized = false }: MifiControlPageProps = {}) {
  const [device, setDevice] = useState<MifiDevice | null>(null);
  const [displayName, setDisplayName] = useState('Primary MiFi');
  const [carrierName, setCarrierName] = useState('');
  const [lineNumber, setLineNumber] = useState('');
  const [destination, setDestination] = useState('');
  const [reason, setReason] = useState<ForwardingReason>('all');
  const [desiredEnabled, setDesiredEnabled] = useState(false);
  const [noAnswerSeconds, setNoAnswerSeconds] = useState(20);
  const [validationMessage, setValidationMessage] = useState('');
  const [operationState, setOperationState] = useState<OperationState>('idle');
  const [resultMessage, setResultMessage] = useState('No network operation has been submitted.');
  const [lastRequestedRule, setLastRequestedRule] = useState<CallForwardingRule | null>(null);

  useEffect(() => {
    let active = true;
    adapter.getDevice(deviceId, demoAtlasContext.scope)
      .then((nextDevice) => {
        if (active) setDevice(nextDevice);
      })
      .catch((error) => {
        if (!active) return;
        setResultMessage(error instanceof Error ? error.message : 'Unable to discover the MiFi device.');
        setOperationState('failed');
      });
    return () => {
      active = false;
    };
  }, [adapter]);

  const canWrite = Boolean(
    writeAuthorized &&
    device?.connectionState === 'connected' &&
    device.capabilities.callForwarding
  );
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
      return null;
    }
    try {
      const normalized = normalizeNanpE164(destination);
      setValidationMessage('');
      return normalized;
    } catch (error) {
      setValidationMessage(error instanceof Error ? error.message : 'Invalid destination number.');
      return null;
    }
  }

  function forwardingRequest(enabled: boolean) {
    if (!device) {
      setResultMessage('The MiFi device has not been discovered yet.');
      setOperationState('failed');
      return null;
    }
    const normalized = validateDestination();
    if (!normalized) return null;

    try {
      return validateForwardingRequest(device, {
        deviceId: device.id,
        scope: demoAtlasContext.scope,
        rule: {
          enabled,
          reason,
          destinationE164: normalized,
          ...(reason === 'no-answer' ? { noAnswerSeconds } : {})
        }
      });
    } catch (error) {
      setResultMessage(error instanceof Error ? error.message : 'The forwarding request is invalid.');
      setOperationState('failed');
      return null;
    }
  }

  async function submitForwarding(enabled: boolean) {
    if (!canWrite || operationState === 'submitting') return;
    const request = forwardingRequest(enabled);
    if (!request) return;

    setOperationState('submitting');
    setResultMessage('Submitting the forwarding request to the authorized MiFi adapter.');
    try {
      const result = await adapter.setCallForwarding(request);
      if (!result.accepted) {
        throw new TelecomError('NETWORK_REJECTED', result.networkMessage ?? 'The modem or network rejected the request.');
      }
      setDesiredEnabled(enabled);
      setLastRequestedRule(request.rule);
      setOperationState('idle');
      setResultMessage(result.networkMessage
        ? `Command accepted: ${result.networkMessage}. Verify network state before treating it as active.`
        : 'Command accepted. Verify network state before treating it as active.');
    } catch (error) {
      setOperationState('failed');
      setResultMessage(error instanceof Error ? error.message : 'The forwarding request failed.');
    }
  }

  async function verifyForwarding() {
    if (!canWrite || !lastRequestedRule || operationState === 'submitting') return;
    setOperationState('submitting');
    setResultMessage('Reading the forwarding rule back from the modem or network.');
    try {
      const activeRules = await adapter.verifyCallForwarding(deviceId, demoAtlasContext.scope);
      if (!rulesMatch(lastRequestedRule, activeRules)) {
        throw new TelecomError('VERIFICATION_MISMATCH', 'Network read-back does not match the requested forwarding rule.');
      }
      setOperationState('verified');
      setResultMessage('Network read-back matches the requested forwarding rule.');
    } catch (error) {
      setOperationState('failed');
      setResultMessage(error instanceof Error ? error.message : 'Forwarding verification failed.');
    }
  }

  const operationLabel = operationState === 'verified'
    ? 'Verified'
    : operationState === 'failed'
      ? 'Failed'
      : operationState === 'submitting'
        ? 'Submitting'
        : 'Ready';

  return (
    <div className="page-stack mifi-page">
      <header className="page-header">
        <p className="eyebrow">Telecom / Devices / MiFi</p>
        <h1>MiFi Control</h1>
        <p>Configure the device locally and expose network controls only after an authorized modem adapter confirms support.</p>
      </header>

      {device?.connectionState !== 'connected' && <div className="notice strong" role="status">{unavailableNotice}</div>}

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
          <label className="toggle-field"><span>Desired state</span><span className="toggle-control"><input aria-label="Forwarding enabled" type="checkbox" checked={desiredEnabled} onChange={(event) => setDesiredEnabled(event.target.checked)} /><strong>{desiredEnabled ? 'ON' : 'OFF'}</strong></span></label>
          <label className="field"><span>Forward calls to</span><input value={destination} onChange={(event) => setDestination(event.target.value)} onBlur={validateDestination} inputMode="tel" aria-describedby="destination-message" /></label>
          <label className="field"><span>Forwarding mode</span><select value={reason} onChange={(event) => setReason(event.target.value as ForwardingReason)}><option value="all">All calls</option><option value="busy">When busy</option><option value="no-answer">No answer</option><option value="not-reachable">Not reachable</option></select></label>
          {reason === 'no-answer' && <label className="field"><span>No-answer delay</span><input type="number" min={5} max={30} value={noAnswerSeconds} onChange={(event) => setNoAnswerSeconds(Number(event.target.value))} /></label>}
        </div>
        <p id="destination-message" className="field-message" aria-live="polite">{validationMessage}</p>
        <div className="mifi-actions">
          <button disabled={!canWrite || operationState === 'submitting'} onClick={() => void submitForwarding(true)}>Activate forwarding</button>
          <button disabled={!canWrite || !lastRequestedRule || operationState === 'submitting'} onClick={() => void verifyForwarding()}>Verify forwarding</button>
          <button disabled={!canWrite || operationState === 'submitting'} onClick={() => void submitForwarding(false)}>Disable forwarding</button>
        </div>
        <div className="connection-gate mifi-result" role="status" aria-live="polite">
          <strong>{operationLabel}</strong><span>{resultMessage}</span>
        </div>
      </section>
    </div>
  );
}
