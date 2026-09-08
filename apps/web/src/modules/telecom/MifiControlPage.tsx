import { useEffect, useMemo, useState } from 'react';
import type { TenantScope } from '../../../../../packages/core/src';
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
  type OperationState,
} from '../../../../../packages/telecom/src';

const defaultAdapter = new UnavailableMifiAdapter();
const deviceId = 'primary-mifi';
const unavailableNotice =
  'No authorized MiFi device adapter is connected. ATLAS will not report carrier state until a real modem confirms it.';
const scopeNotice =
  'Telecom tenant scope is not configured. Network controls remain disabled until ATLAS Identity resolves an explicit tenant scope.';
const idleWithoutScopeNotice =
  'No network operation can run until Telecom scope and an authorized adapter are configured.';

type MifiControlPageProps = {
  adapter?: MifiAdapter;
  scope?: TenantScope | null;
  writeAuthorized?: boolean;
};

export function MifiControlPage({
  adapter = defaultAdapter,
  scope = null,
  writeAuthorized = false,
}: MifiControlPageProps = {}) {
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
  const [resultMessage, setResultMessage] = useState(
    scope ? 'No network operation has been submitted.' : idleWithoutScopeNotice,
  );
  const [lastRequestedRule, setLastRequestedRule] = useState<CallForwardingRule | null>(null);

  useEffect(() => {
    let active = true;

    if (!scope) {
      setDevice(null);
      setOperationState('idle');
      setResultMessage(idleWithoutScopeNotice);
      return () => {
        active = false;
      };
    }

    setResultMessage('Discovering the configured MiFi device through the authorized adapter.');
    void adapter
      .getDevice(deviceId, scope)
      .then((nextDevice) => {
        if (!active) return;
        setDevice(nextDevice);
        if (nextDevice.connectionState !== 'connected') {
          setResultMessage(unavailableNotice);
        } else {
          setDisplayName(nextDevice.displayName || 'Primary MiFi');
          setCarrierName(nextDevice.carrierName ?? '');
          setLineNumber(nextDevice.lineNumber ?? '');
          setResultMessage('Authorized adapter discovered the MiFi device. No network operation has been submitted.');
        }
      })
      .catch((error) => {
        if (!active) return;
        setResultMessage(error instanceof Error ? error.message : 'Unable to discover the MiFi device.');
        setOperationState('failed');
      });

    return () => {
      active = false;
    };
  }, [adapter, scope]);

  const canWrite = Boolean(
    scope &&
      writeAuthorized &&
      device?.connectionState === 'connected' &&
      device.capabilities.callForwarding,
  );

  const capabilityEntries = useMemo(
    () =>
      device
        ? ([
            ['Call Forwarding', device.capabilities.callForwarding],
            ['SMS', device.capabilities.sms],
            ['USSD', device.capabilities.ussd],
            ['AT Commands', device.capabilities.atCommands],
            ['QMI', device.capabilities.qmi],
            ['MBIM', device.capabilities.mbim],
          ] as const)
        : [],
    [device],
  );

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
    if (!scope) {
      setResultMessage(scopeNotice);
      setOperationState('failed');
      return null;
    }

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
        scope,
        rule: {
          enabled,
          reason,
          destinationE164: normalized,
          ...(reason === 'no-answer' ? { noAnswerSeconds } : {}),
        },
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
        throw new TelecomError(
          'NETWORK_REJECTED',
          result.networkMessage ?? 'The modem or network rejected the request.',
        );
      }

      setDesiredEnabled(enabled);
      setLastRequestedRule(request.rule);
      setOperationState('idle');
      setResultMessage(
        result.networkMessage
          ? `Command accepted: ${result.networkMessage}. Verify network state before treating it as active.`
          : 'Command accepted. Verify network state before treating it as active.',
      );
    } catch (error) {
      setOperationState('failed');
      setResultMessage(error instanceof Error ? error.message : 'The forwarding request failed.');
    }
  }

  async function verifyForwarding() {
    if (!scope || !canWrite || !device || !lastRequestedRule || operationState === 'submitting') return;

    setOperationState('submitting');
    setResultMessage('Reading the forwarding rule back from the modem or network.');

    try {
      const activeRules = await adapter.verifyCallForwarding(device.id, scope);
      if (!rulesMatch(lastRequestedRule, activeRules)) {
        throw new TelecomError(
          'VERIFICATION_MISMATCH',
          'Network read-back does not match the requested forwarding rule.',
        );
      }

      setOperationState('verified');
      setResultMessage('Network read-back matches the requested forwarding rule.');
    } catch (error) {
      setOperationState('failed');
      setResultMessage(error instanceof Error ? error.message : 'Forwarding verification failed.');
    }
  }

  const operationLabel =
    operationState === 'verified'
      ? 'Verified'
      : operationState === 'failed'
        ? 'Failed'
        : operationState === 'submitting'
          ? 'Submitting'
          : 'Ready';

  const providerNotice =
    device?.connectionState === 'connected'
      ? 'Authorized MiFi adapter reported the device as connected. Call-forwarding state is not verified until network read-back succeeds.'
      : unavailableNotice;

  return (
    <main className="atlas-page atlas-module-page telecom-mifi-page">
      <header className="telecom-mifi-page__header">
        <p className="atlas-eyebrow">Telecom / Devices / MiFi</p>
        <h1>MiFi Control</h1>
        <p className="atlas-page__lede">
          Configure the device locally and expose network controls only after an authorized modem adapter confirms support.
        </p>
      </header>

      <div className="atlas-status-panel atlas-status-panel--degraded" role="status">
        <strong>Provider state</strong>
        <span>{providerNotice}</span>
        {!scope && <span>{scopeNotice}</span>}
      </div>

      <section className="telecom-card" aria-labelledby="mifi-device-heading">
        <div>
          <p className="atlas-eyebrow">Device</p>
          <h2 id="mifi-device-heading">Configuration</h2>
        </div>
        <div className="telecom-form-grid">
          <label className="telecom-field">
            <span>Device name</span>
            <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
          </label>
          <label className="telecom-field">
            <span>Carrier</span>
            <input value={carrierName} onChange={(event) => setCarrierName(event.target.value)} placeholder="Carrier label" />
          </label>
          <label className="telecom-field">
            <span>MiFi line</span>
            <input value={lineNumber} onChange={(event) => setLineNumber(event.target.value)} inputMode="tel" placeholder="Phone number" />
          </label>
        </div>
        <div className="telecom-connection-state">
          <strong>Adapter state</strong>
          <span>{device?.connectionState ?? 'not configured'}</span>
        </div>
      </section>

      <section className="telecom-card" aria-labelledby="mifi-capabilities-heading">
        <div>
          <p className="atlas-eyebrow">Capabilities</p>
          <h2 id="mifi-capabilities-heading">Modem controls</h2>
        </div>
        {capabilityEntries.length > 0 ? (
          <div className="telecom-capability-grid">
            {capabilityEntries.map(([label, supported]) => (
              <article key={label}>
                <span>{label}</span>
                <strong>{supported ? 'Supported' : 'Unavailable'}</strong>
              </article>
            ))}
          </div>
        ) : (
          <p className="atlas-page__lede">Capabilities remain unavailable until an authorized adapter discovers the device.</p>
        )}
      </section>

      <section className="telecom-card" aria-labelledby="mifi-forwarding-heading">
        <div>
          <p className="atlas-eyebrow">Voice</p>
          <h2 id="mifi-forwarding-heading">Call Forwarding</h2>
        </div>
        <div className="telecom-form-grid">
          <label className="telecom-field telecom-toggle-field">
            <span>Desired state</span>
            <span>
              <input
                aria-label="Forwarding enabled"
                type="checkbox"
                checked={desiredEnabled}
                onChange={(event) => setDesiredEnabled(event.target.checked)}
              />
              <strong>{desiredEnabled ? 'ON' : 'OFF'}</strong>
            </span>
          </label>
          <label className="telecom-field">
            <span>Forward calls to</span>
            <input
              value={destination}
              onChange={(event) => setDestination(event.target.value)}
              onBlur={validateDestination}
              inputMode="tel"
              aria-describedby="destination-message"
            />
          </label>
          <label className="telecom-field">
            <span>Forwarding mode</span>
            <select value={reason} onChange={(event) => setReason(event.target.value as ForwardingReason)}>
              <option value="all">All calls</option>
              <option value="busy">When busy</option>
              <option value="no-answer">No answer</option>
              <option value="not-reachable">Not reachable</option>
            </select>
          </label>
          {reason === 'no-answer' && (
            <label className="telecom-field">
              <span>No-answer delay</span>
              <input
                type="number"
                min={5}
                max={30}
                value={noAnswerSeconds}
                onChange={(event) => setNoAnswerSeconds(Number(event.target.value))}
              />
            </label>
          )}
        </div>
        <p id="destination-message" className="telecom-field-message" aria-live="polite">
          {validationMessage}
        </p>
        <div className="telecom-actions">
          <button disabled={!canWrite || operationState === 'submitting'} onClick={() => void submitForwarding(true)}>
            Activate forwarding
          </button>
          <button
            disabled={!canWrite || !lastRequestedRule || operationState === 'submitting'}
            onClick={() => void verifyForwarding()}
          >
            Verify forwarding
          </button>
          <button disabled={!canWrite || operationState === 'submitting'} onClick={() => void submitForwarding(false)}>
            Disable forwarding
          </button>
        </div>
        <div className="telecom-connection-state telecom-result" role="status" aria-live="polite">
          <strong>{operationLabel}</strong>
          <span>{resultMessage}</span>
        </div>
      </section>
    </main>
  );
}
