import { useEffect, useMemo, useState } from 'react';
import {
  createLocalAgentEnrollment,
  enqueueLocalDeviceCommand,
  listLocalAgents,
  listLocalCommands,
  listLocalDevices,
  revokeLocalAgent,
  revokeLocalAgentMtls,
  type AtlasLocalAgent,
  type AtlasLocalCommand,
  type AtlasLocalDevice
} from './localControlApi';
import {
  buildDeviceOsPosture,
  evaluateAgentTrust
} from './deviceOSControlTower';

function errorMessage(error: unknown) {
  const code = error instanceof Error ? error.message : 'local_control_failed';
  const known: Record<string, string> = {
    permission_required: 'Your ATLAS role does not permit this Local Control action.',
    permission_lookup_failed: 'ATLAS could not verify the current Device OS permission set.',
    approved_execution_approval_required: 'High-risk device actions require an approved ATLAS Execution approval.',
    capability_not_declared: 'The selected device did not declare that capability.',
    device_not_found: 'The registered device is no longer available.'
  };
  return known[code] || code.replaceAll('_', ' ');
}

function trustLabel(state: ReturnType<typeof evaluateAgentTrust>) {
  const labels: Record<ReturnType<typeof evaluateAgentTrust>, string> = {
    'verified-active': 'Verified active',
    'connected-unverified': 'Connected · trust incomplete',
    'enrolled-unverified': 'Enrolled · not verified',
    stale: 'Stale heartbeat',
    'certificate-expired': 'Certificate expired',
    revoked: 'Revoked'
  };
  return labels[state];
}

export function LocalControlPlanePanel() {
  const [agents, setAgents] = useState<AtlasLocalAgent[]>([]);
  const [devices, setDevices] = useState<AtlasLocalDevice[]>([]);
  const [commands, setCommands] = useState<AtlasLocalCommand[]>([]);
  const [agentName, setAgentName] = useState('');
  const [enrollmentCode, setEnrollmentCode] = useState<string | null>(null);
  const [enrollmentExpires, setEnrollmentExpires] = useState<string | null>(null);
  const [status, setStatus] = useState('Loading Local Control Plane…');
  const [observedAt, setObservedAt] = useState(() => new Date().toISOString());
  const [busy, setBusy] = useState(false);

  async function refresh() {
    try {
      const [nextAgents, nextDevices, nextCommands] = await Promise.all([
        listLocalAgents(),
        listLocalDevices(),
        listLocalCommands()
      ]);
      setAgents(nextAgents);
      setDevices(nextDevices);
      setCommands(nextCommands);
      setObservedAt(new Date().toISOString());
      setStatus(
        `${nextAgents.length} agent(s), ${nextDevices.length} device(s), ${nextCommands.filter(
          (command) => command.status === 'queued' || command.status === 'claimed'
        ).length} active command(s).`
      );
    } catch (error) {
      setStatus(errorMessage(error));
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  const agentById = useMemo(
    () => new Map(agents.map((agent) => [agent.id, agent])),
    [agents]
  );

  const posture = useMemo(
    () => buildDeviceOsPosture({ agents, devices, commands, now: observedAt }),
    [agents, devices, commands, observedAt]
  );

  async function createEnrollment() {
    setBusy(true);
    try {
      const result = await createLocalAgentEnrollment(agentName);
      setEnrollmentCode(result.enrollment_code);
      setEnrollmentExpires(result.enrollment.expires_at);
      setAgentName('');
      setStatus('One-time enrollment code created. ATLAS stores only its digest.');
    } catch (error) {
      setStatus(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function revoke(agentId: string) {
    setBusy(true);
    try {
      await revokeLocalAgent(agentId);
      await refresh();
    } catch (error) {
      setStatus(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function revokeMtls(agentId: string) {
    setBusy(true);
    try {
      await revokeLocalAgentMtls(agentId);
      await refresh();
      setStatus('ATLAS mTLS trust revoked locally. Provider revocation must also complete through the signed certificate workflow.');
    } catch (error) {
      setStatus(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function healthCheck(device: AtlasLocalDevice) {
    setBusy(true);
    try {
      const capability = device.capabilities.includes('health.check')
        ? 'health.check'
        : device.capabilities[0];
      if (!capability) throw new Error('device_has_no_declared_capabilities');

      const result = await enqueueLocalDeviceCommand({
        deviceId: device.id,
        agentId: device.agent_id,
        capability,
        action: 'status.read',
        riskLevel: 'low'
      });
      setStatus(
        result.realtime.delivered > 0
          ? 'Command queued and realtime agent notified.'
          : 'Command queued. Realtime unavailable; polling fallback remains active.'
      );
      await refresh();
    } catch (error) {
      setStatus(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="feature-card wide" aria-labelledby="local-control-title">
      <div className="card-heading">
        <div>
          <p className="eyebrow">ATLAS Local Control Plane</p>
          <h2 id="local-control-title">Agents & Devices</h2>
        </div>
        <span className={posture.state === 'operational' ? 'status-chip' : 'status-chip neutral'}>
          {posture.state === 'empty' ? 'No runtime evidence' : posture.state === 'operational' ? 'Evidence healthy' : 'Attention'}
        </span>
      </div>

      <p>
        Use a Local Agent when a device cannot expose a browser-safe CORS endpoint.
        Enrollment and sessions are short-lived; secrets are never stored in browser
        persistence or device telemetry.
      </p>
      <div className="notice">
        No LAN scanning. No device is shown as connected unless a registered agent reports it.
        High/critical actions remain bound to ATLAS Approval Center.
      </div>

      <section aria-labelledby="device-os-trust-posture">
        <div className="card-heading">
          <div>
            <p className="eyebrow">Evidence plane</p>
            <h3 id="device-os-trust-posture">Device OS Trust Posture</h3>
          </div>
          <span className="status-chip neutral">Observed {new Date(observedAt).toLocaleTimeString()}</span>
        </div>
        <div className="stat-grid">
          <article><strong>{posture.verifiedAgents}</strong><span>provider-verified active agents</span></article>
          <article><strong>{posture.reportedDevices}</strong><span>reported registered devices</span></article>
          <article><strong>{posture.activeCommands}</strong><span>queued or claimed commands</span></article>
          <article><strong>{posture.failedCommands}</strong><span>failed commands in loaded evidence</span></article>
        </div>
        {posture.state === 'empty' ? (
          <div className="notice">
            No Local Agent, device or command evidence exists yet. ATLAS therefore does not claim a live Device OS runtime.
          </div>
        ) : null}
        {posture.issues.map((issue) => (
          <div className={issue.severity === 'critical' ? 'notice strong' : 'notice'} key={issue.code}>
            <strong>{issue.title}</strong>
            <p>{issue.detail}</p>
            <small>{issue.remediation}</small>
          </div>
        ))}
      </section>

      <div className="filter-row">
        <label>
          Agent name
          <input
            value={agentName}
            onChange={(event) => setAgentName(event.target.value)}
            placeholder="Front Desk Agent"
          />
        </label>
        <button
          type="button"
          disabled={busy || !agentName.trim()}
          onClick={() => void createEnrollment()}
        >
          Create one-time enrollment
        </button>
      </div>

      {enrollmentCode ? (
        <div className="notice strong" role="status">
          <strong>One-time enrollment code</strong>
          <p><code>{enrollmentCode}</code></p>
          <small>
            Expires {enrollmentExpires ? new Date(enrollmentExpires).toLocaleString() : 'soon'}.
            Do not paste this code into chat, tickets or source control.
          </small>
          <div>
            <button
              type="button"
              onClick={() => {
                setEnrollmentCode(null);
                setEnrollmentExpires(null);
              }}
            >
              Hide code
            </button>
          </div>
        </div>
      ) : null}

      <div className="notice" role="status">{status}</div>

      <h3>mTLS trust chain</h3>
      <div className="notice strong">
        Active mTLS trust is provider-backed only. Cloudflare certificate issuance is synchronized
        through the signed GitHub OIDC workflow; entering a fingerprint in the browser cannot make
        an agent trusted. Realtime control remains fail-closed until the provider certificate and a
        fresh agent heartbeat are both evidenced.
      </div>

      <h3>Registered agents</h3>
      <div className="module-grid compact">
        {agents.map((agent) => {
          const trust = evaluateAgentTrust(agent, observedAt);
          return (
            <div className="module-card" key={agent.id}>
              <span>{agent.platform} · {agent.agent_version}</span>
              <strong>{agent.name}</strong>
              <p>
                {agent.capabilities.length
                  ? agent.capabilities.join(', ')
                  : 'No capabilities reported yet.'}
              </p>
              <p>
                mTLS: {agent.mtls_status}
                {agent.mtls_cert_expires_at
                  ? ` · expires ${new Date(agent.mtls_cert_expires_at).toLocaleDateString()}`
                  : ''}
              </p>
              <p>
                Realtime:{' '}
                {agent.realtime_last_connected_at
                  ? `last authorized ${new Date(agent.realtime_last_connected_at).toLocaleString()}`
                  : 'not yet authorized'}
              </p>
              <span className={trust === 'verified-active' ? 'status-chip' : 'status-chip warning'}>
                {trustLabel(trust)}
              </span>
              {agent.mtls_status === 'active' ? (
                <button type="button" disabled={busy} onClick={() => void revokeMtls(agent.id)}>
                  Revoke ATLAS mTLS trust
                </button>
              ) : null}
              <button
                type="button"
                disabled={busy || agent.status === 'revoked'}
                onClick={() => void revoke(agent.id)}
              >
                Revoke agent
              </button>
            </div>
          );
        })}
      </div>

      <h3>Devices</h3>
      <div className="module-grid compact">
        {devices.map((device) => (
          <div className="module-card" key={device.id}>
            <span>{device.device_type} · {device.adapter}</span>
            <strong>{device.label}</strong>
            <p>
              Agent: {agentById.get(device.agent_id)?.name || 'Unknown'} ·{' '}
              {device.capabilities.join(', ') || 'No capabilities'}
            </p>
            <span className={device.health_status === 'healthy' ? 'status-chip' : 'status-chip warning'}>
              {device.health_status}
            </span>
            <button
              type="button"
              disabled={busy || !device.capabilities.length}
              onClick={() => void healthCheck(device)}
            >
              Queue status check
            </button>
          </div>
        ))}
      </div>

      <h3>Recent commands</h3>
      <div className="module-grid compact">
        {commands.slice(0, 12).map((command) => (
          <div className="module-card" key={command.id}>
            <span>{command.risk_level} · {command.status}</span>
            <strong>{command.action}</strong>
            <p>
              {command.capability}
              {command.error_code ? ` · ${command.error_code}` : ''}
            </p>
          </div>
        ))}
      </div>
    </article>
  );
}
