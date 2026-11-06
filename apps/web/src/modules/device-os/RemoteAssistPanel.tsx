import { useEffect, useMemo, useState } from 'react';
import {
  listLocalAgents,
  listLocalDevices,
  type AtlasLocalAgent,
  type AtlasLocalDevice
} from './localControlApi';
import { summarizeRemoteCandidates } from './remoteAssistCompatibility';

type AssistReadiness = 'loading' | 'not-enrolled' | 'secure-agent-required' | 'adapter-required' | 'error';

function statusLabel(status: AssistReadiness) {
  switch (status) {
    case 'loading': return 'Checking';
    case 'not-enrolled': return 'Enrollment required';
    case 'secure-agent-required': return 'mTLS required';
    case 'adapter-required': return 'Native adapter required';
    case 'error': return 'Unavailable';
  }
}

export function RemoteAssistPanel() {
  const [agents, setAgents] = useState<AtlasLocalAgent[]>([]);
  const [devices, setDevices] = useState<AtlasLocalDevice[]>([]);
  const [state, setState] = useState<AssistReadiness>('loading');
  const [message, setMessage] = useState('Checking remote-assistance prerequisites…');

  useEffect(() => {
    let mounted = true;

    void Promise.all([listLocalAgents(), listLocalDevices()])
      .then(([nextAgents, nextDevices]) => {
        if (!mounted) return;
        setAgents(nextAgents);
        setDevices(nextDevices);

        const { onlineAgents, secureAgents, declaredDevices } = summarizeRemoteCandidates(
          nextAgents, nextDevices
        );

        if (!onlineAgents.length) {
          setState('not-enrolled');
          setMessage('No online supported desktop or attended-mobile Local Agent is currently reporting to ATLAS.');
          return;
        }
        if (!secureAgents.length) {
          setState('secure-agent-required');
          setMessage('An eligible agent is online, but no active mTLS binding is verified.');
          return;
        }
        if (!declaredDevices.length) {
          setState('adapter-required');
          setMessage('The secure agent is online. Full desktop assistance remains blocked until a signed native remote-desktop adapter reports its real capabilities.');
          return;
        }

        // A capability declaration is untrusted metadata, not signed adapter or session evidence.
        // Fail closed until the canonical backend verifies adapter signature, device binding,
        // tenant scope, consent, session lifetime and revocation at session creation.
        setState('adapter-required');
        setMessage('Remote capability declared, but signed native adapter and authorized session evidence are not verified. Desktop control remains blocked.');
      })
      .catch((error: unknown) => {
        if (!mounted) return;
        setState('error');
        setMessage(error instanceof Error ? error.message.replaceAll('_', ' ') : 'Remote Assist readiness could not be loaded.');
      });

    return () => {
      mounted = false;
    };
  }, []);

  const browserOperator = useMemo(
    () => devices.find(
      (device) => device.adapter === 'browser-cdp' && device.capabilities.includes('browser.control')
    ),
    [devices]
  );

  const candidateSummary = useMemo(
    () => summarizeRemoteCandidates(agents, devices),
    [agents, devices]
  );
  const remoteDevices = candidateSummary.declaredDevices;

  return (
    <article className="feature-card wide" aria-labelledby="remote-assist-title">
      <div className="card-heading">
        <div>
          <p className="eyebrow">ATLAS Remote Assist</p>
          <h2 id="remote-assist-title">Governed remote support</h2>
        </div>
        <span className="status-chip warning">
          {statusLabel(state)}
        </span>
      </div>

      <p>
        ATLAS reuses the existing Local Control Plane across Windows, macOS, Linux and
        eligible attended mobile hosts. Browser viewers may use iPhone, iPad, Android
        and compatible computers. iOS does not expose unattended native input control.
        Capability declarations are not proof of a live or authorized session.
      </p>

      <div className="notice strong" role="status">{message}</div>

      <div className="module-grid compact" aria-label="ATLAS Remote Assist readiness">
        <div className="module-card">
          <span>Identity & transport</span>
          <strong>Cross-platform Local Agent</strong>
          <p>
            {candidateSummary.onlineAgents.length
              ? 'An eligible desktop or attended-mobile Local Agent is reporting to ATLAS.'
              : 'Enroll an authorized supported host through the existing Local Control Plane. Browser viewers can use other device types.'}
          </p>
          <a href="#local-control-title">Open Local Control Plane</a>
        </div>

        <div className="module-card">
          <span>Zero Trust</span>
          <strong>mTLS session boundary</strong>
          <p>
            {candidateSummary.secureAgents.length
              ? 'An active mTLS binding is present on an eligible online host agent.'
              : 'Remote support stays blocked until a host agent has an active mTLS certificate binding.'}
          </p>
        </div>

        <div className="module-card">
          <span>Current executable capability</span>
          <strong>Browser Operator</strong>
          <p>
            {browserOperator
              ? `${browserOperator.label} can perform governed browser actions through the existing browser-cdp adapter.`
              : 'No browser-cdp device is currently registered. Browser automation is available only after explicit configuration.'}
          </p>
        </div>

        <div className="module-card">
          <span>Native desktop boundary</span>
          <strong>Screen + input control</strong>
          <p>
            {remoteDevices.length
              ? `${remoteDevices.length} device(s) declare remote desktop capabilities. These are matching host declarations, not signed adapter or active session evidence.`
              : 'No native remote-desktop adapter is registered. ATLAS will not simulate or falsely label unattended desktop control as active.'}
          </p>
        </div>
      </div>

      <div className="notice">
        Microsoft Quick Assist remains a manual, user-approved fallback outside the ATLAS control plane.
        The universal ATLAS viewer is a planned authenticated HTTPS experience, not a provisioned
        remote-control URL. A supported host needs its own authorized adapter and internet connection.
        Remote support requires explicit consent, least privilege, short-lived sessions, audit
        evidence and immediate revocation.
      </div>
    </article>
  );
}
