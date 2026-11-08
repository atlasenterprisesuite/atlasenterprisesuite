import { useEffect, useMemo, useState } from 'react';
import {
  listLocalAgents,
  listLocalDevices,
  type AtlasLocalAgent,
  type AtlasLocalDevice
} from './localControlApi';

type AssistReadiness = 'loading' | 'not-enrolled' | 'secure-agent-required' | 'adapter-required' | 'ready' | 'error';

function isWindows(agent: AtlasLocalAgent) {
  const platform = agent.platform.toLowerCase();
  return platform === 'win32' || platform.includes('windows');
}

function hasRemoteView(device: AtlasLocalDevice) {
  return device.capabilities.includes('remote.desktop.view');
}

function hasRemoteControl(device: AtlasLocalDevice) {
  return device.capabilities.includes('remote.desktop.control');
}

function statusLabel(status: AssistReadiness) {
  switch (status) {
    case 'loading': return 'Checking';
    case 'not-enrolled': return 'Enrollment required';
    case 'secure-agent-required': return 'mTLS required';
    case 'adapter-required': return 'Native adapter required';
    case 'ready': return 'Evidence verified';
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

        const liveWindowsAgents = nextAgents.filter(
          (agent) => isWindows(agent) && agent.status === 'online'
        );
        const secureWindowsAgents = liveWindowsAgents.filter(
          (agent) => agent.mtls_status === 'active'
        );
        const remoteDevices = nextDevices.filter(
          (device) => hasRemoteView(device) || hasRemoteControl(device)
        );

        if (!liveWindowsAgents.length) {
          setState('not-enrolled');
          setMessage('No online Windows Local Agent is currently reporting to ATLAS.');
          return;
        }
        if (!secureWindowsAgents.length) {
          setState('secure-agent-required');
          setMessage('A Windows agent is online, but no active mTLS binding is verified.');
          return;
        }
        if (!remoteDevices.length) {
          setState('adapter-required');
          setMessage('The secure agent is online. Full desktop assistance remains blocked until a signed native remote-desktop adapter reports its real capabilities.');
          return;
        }

        setState('ready');
        setMessage('A secure Windows agent and a declared native remote-desktop capability are both present.');
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

  const remoteDevices = useMemo(
    () => devices.filter((device) => hasRemoteView(device) || hasRemoteControl(device)),
    [devices]
  );

  return (
    <article className="feature-card wide" aria-labelledby="remote-assist-title">
      <div className="card-heading">
        <div>
          <p className="eyebrow">ATLAS Remote Assist</p>
          <h2 id="remote-assist-title">Governed remote support</h2>
        </div>
        <span className={state === 'ready' ? 'status-chip' : 'status-chip warning'}>
          {statusLabel(state)}
        </span>
      </div>

      <p>
        ATLAS reuses the existing Local Control Plane for identity, tenant scope, mTLS,
        command audit and approvals. It does not claim full desktop control unless a real
        native adapter reports explicit screen-view or input-control capabilities.
      </p>

      <div className="notice strong" role="status">{message}</div>

      <div className="module-grid compact" aria-label="ATLAS Remote Assist readiness">
        <div className="module-card">
          <span>Identity & transport</span>
          <strong>Windows Local Agent</strong>
          <p>
            {agents.some((agent) => isWindows(agent) && agent.status === 'online')
              ? 'An online Windows Local Agent is reporting to ATLAS.'
              : 'Enroll this PC with the existing Windows Local Agent installer.'}
          </p>
          <a href="#local-control-title">Open Local Control Plane</a>
        </div>

        <div className="module-card">
          <span>Zero Trust</span>
          <strong>mTLS session boundary</strong>
          <p>
            {agents.some((agent) => isWindows(agent) && agent.status === 'online' && agent.mtls_status === 'active')
              ? 'An active mTLS binding is present for an online Windows agent.'
              : 'Remote support stays blocked until the agent has an active mTLS certificate binding.'}
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
              ? `${remoteDevices.length} device(s) declare remote desktop capabilities. ATLAS still relies on Local Control Plane policy and audit for each command.`
              : 'No native remote-desktop adapter is registered. ATLAS will not simulate or falsely label unattended desktop control as active.'}
          </p>
        </div>
      </div>

      <div className="notice">
        Microsoft Quick Assist remains a manual, user-approved fallback outside the ATLAS control plane.
        The ATLAS target is provider-neutral remote support with explicit consent, least privilege,
        expiring sessions, visible session state, audit evidence and immediate revocation.
      </div>
    </article>
  );
}
