import { useEffect, useMemo, useState } from 'react';
import {
  enqueueLocalDeviceCommand, listLocalAgents, listLocalCommands, listLocalDevices,
  type AtlasLocalAgent, type AtlasLocalCommand, type AtlasLocalDevice
} from './localControlApi';
import { phoenixDiagnosticTargets, phoenixCommandOutcome } from './phoenixControlPolicy';

/** Phoenix bootstrap v0: uses the existing audit-backed read-only command queue. */
export function PhoenixControlPanel() {
  const [agents, setAgents] = useState<AtlasLocalAgent[]>([]);
  const [devices, setDevices] = useState<AtlasLocalDevice[]>([]);
  const [commands, setCommands] = useState<AtlasLocalCommand[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [pending, setPending] = useState(false);
  const [command, setCommand] = useState<{ id: string; deviceId: string } | null>(null);
  const [message, setMessage] = useState('Checking authorized Phoenix diagnostic targets.');

  const targets = useMemo(() => phoenixDiagnosticTargets(agents, devices), [agents, devices]);
  const selected = targets.find((target) => target.id === selectedId) || targets[0] || null;
  const outcome = phoenixCommandOutcome(command?.id ?? null, command?.deviceId ?? null, commands);

  useEffect(() => {
    let active = true;
    void Promise.all([listLocalAgents(), listLocalDevices(), listLocalCommands()])
      .then(([a, d, c]) => {
        if (!active) return;
        setAgents(a); setDevices(d); setCommands(c);
        setMessage('Agent inventory loaded; signed auto-update is not available.');
      })
      .catch(() => { if (active) setMessage('No verified inventory; diagnostics blocked.'); });
    return () => { active = false; };
  }, []);

  async function refresh() {
    if (pending) return;
    setPending(true);
    try {
      const [a, d, c] = await Promise.all([listLocalAgents(), listLocalDevices(), listLocalCommands()]);
      setAgents(a); setDevices(d); setCommands(c);
      setMessage('Refreshed from the authorized Local Control Plane.');
    } catch {
      setMessage('Refresh denied or unavailable; results may be stale.');
    } finally { setPending(false); }
  }

  async function startDiagnostic() {
    if (pending || !selected) return;
    setPending(true); setCommand(null);
    try {
      const queued = await enqueueLocalDeviceCommand({
        deviceId: selected.id, agentId: selected.agentId,
        capability: 'health.check', action: 'status.read', riskLevel: 'low'
      });
      setCommand({ id: queued.command.id, deviceId: selected.id });
      setMessage('Read-only diagnostic queued, not booted or updated. Refresh for actual outcome.');
      setCommands(await listLocalCommands());
    } catch {
      setMessage('Request refused or unavailable. Nothing was updated or repaired.');
    } finally { setPending(false); }
  }

  return (
    <article className="feature-card wide" aria-labelledby="phoenix-control-title">
      <div className="card-heading">
        <div>
          <p className="eyebrow">ATLAS Phoenix · Device OS</p>
          <h2 id="phoenix-control-title">Start · Update · Recover</h2>
        </div>
        <span className="status-chip warning">P0 · native update blocked</span>
      </div>
      <p>
        The existing Windows Local Agent installer configures automatic service startup and
        bounded restart attempts. This web page cannot power on an offline computer, install
        updates, or revive a failed operating system. No unattended control is enabled.
      </p>
      <div className="notice strong" role="status">{message}</div>
      <div className="filter-row">
        <label>
          Registered service
          <select
            aria-label="Registered service"
            value={selected?.id ?? ''}
            onChange={(event) => { setSelectedId(event.target.value); setCommand(null); }}
          >
            {!targets.length ? <option value="">No eligible service</option> : null}
            {targets.map((target) => <option value={target.id} key={target.id}>{target.label}</option>)}
          </select>
        </label>
        <button type="button" disabled={pending || !selected} onClick={() => void startDiagnostic()}>
          Start ATLAS health check
        </button>
        <button type="button" disabled={pending} onClick={() => void refresh()}>
          Refresh actual status
        </button>
      </div>
      <div className="module-grid compact" aria-label="Phoenix stage status">
        <div className="module-card">
          <span>Startup</span><strong>Windows scheduled task</strong>
          <p>Configured by the existing installer; actual host restart not verified here.</p>
        </div>
        <div className="module-card">
          <span>Diagnosis</span><strong>{outcome}</strong>
          <p>Only health.check/status.read. A completed diagnostic is not a repaired OS.</p>
        </div>
        <div className="module-card">
          <span>Auto-update</span><strong>Signed installer required</strong>
          <p>Not activated. Check provenance, exact SHA, approval and tenant isolation first.</p>
        </div>
        <div className="module-card">
          <span>Phoenix rollback</span><strong>Not activated</strong>
          <p>Needs last-known-good recovery, bounded retries and independent verification.</p>
        </div>
      </div>
      <div className="notice">
        Remote desktop, system restart and firmware changes remain fail-closed.
        The Local Control Plane independently authorizes and audits the diagnostic.
      </div>
    </article>
  );
}
