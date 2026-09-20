import { FormEvent, useEffect, useState } from 'react';
import { runtimeIsHealthy } from '../../../../packages/execution/src/work-runtime';
import { enrollWorkRuntime, listWorkRuntimes, type WorkRuntimeSummary } from './api';
import { WorkSubnav } from './WorkSubnav';

function labelKind(kind: WorkRuntimeSummary['kind']) {
  return kind.replaceAll('_', ' ');
}

export function runtimeDisplayStatus(runtime: WorkRuntimeSummary, now: string | Date = new Date()) {
  if (runtime.status === 'online' && !runtimeIsHealthy(runtime, now)) return 'stale';
  return runtime.status;
}

function capabilityList(value: string) {
  return [...new Set(value.split(',').map((item) => item.trim()).filter(Boolean))].slice(0, 40);
}

export function WorkRuntimesPage() {
  const [runtimes, setRuntimes] = useState<WorkRuntimeSummary[] | null>(null);
  const [kind, setKind] = useState<WorkRuntimeSummary['kind']>('local');
  const [label, setLabel] = useState('');
  const [capabilities, setCapabilities] = useState('browser');
  const [runtimeToken, setRuntimeToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadRuntimes = async () => {
    setRuntimes(await listWorkRuntimes());
  };

  useEffect(() => {
    let active = true;
    void listWorkRuntimes()
      .then((rows) => { if (active) setRuntimes(rows); })
      .catch((caught) => { if (active) setError(caught instanceof Error ? caught.message : 'work_runtimes_unavailable'); });
    return () => { active = false; };
  }, []);

  const enroll = async (event: FormEvent) => {
    event.preventDefault();
    if (!label.trim() || busy) return;
    setBusy(true);
    setError(null);
    setSuccess(null);
    setRuntimeToken(null);
    try {
      const result = await enrollWorkRuntime({ kind, label: label.trim(), capabilities: capabilityList(capabilities) });
      setRuntimeToken(result.runtimeToken);
      setLabel('');
      await loadRuntimes();
      setSuccess('Runtime enrolled. It remains offline until its authenticated heartbeat is received.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'work_runtime_enroll_failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="work-page page-stack">
      <header className="page-header"><p className="eyebrow">ATLAS Work Soberano</p><h1>Runtimes</h1><p>Authorized Local, Self-Hosted and Cloud Ephemeral execution workers. Readiness requires a current authenticated heartbeat.</p></header>
      <WorkSubnav />

      <form className="execution-panel work-composer" onSubmit={(event) => void enroll(event)}>
        <h2>Enroll runtime</h2>
        <div className="work-config-grid">
          <label>
            <span>Runtime kind</span>
            <select aria-label="Runtime kind" value={kind} onChange={(event) => setKind(event.target.value as WorkRuntimeSummary['kind'])}>
              <option value="local">Local</option>
              <option value="self_hosted">Self-hosted</option>
              <option value="cloud_ephemeral">Cloud ephemeral</option>
            </select>
          </label>
          <label>
            <span>Label</span>
            <input aria-label="Runtime label" value={label} maxLength={160} onChange={(event) => setLabel(event.target.value)} placeholder="ATLAS Local Agent" required />
          </label>
          <label>
            <span>Capabilities</span>
            <input aria-label="Runtime capabilities" value={capabilities} onChange={(event) => setCapabilities(event.target.value)} placeholder="browser" />
          </label>
        </div>
        <p className="notice">Enrollment returns a one-time runtime token. ATLAS Work displays it only in this in-memory enrollment result and never persists it in browser storage.</p>
        <button className="execution-action" type="submit" disabled={busy || !label.trim()}>{busy ? 'Enrolling…' : 'Enroll runtime'}</button>
      </form>

      {runtimeToken ? (
        <section className="execution-panel" aria-labelledby="runtime-token-title">
          <h2 id="runtime-token-title">One-time runtime token</h2>
          <p className="notice">Save this token directly into the authorized runtime configuration now. It will not be available from the Work runtime list later.</p>
          <code>{runtimeToken}</code>
          <div className="work-actions">
            <button className="execution-action" type="button" onClick={() => setRuntimeToken(null)}>I have saved it securely</button>
          </div>
        </section>
      ) : null}

      {error ? <div role="alert" className="work-error">{error}</div> : null}
      {success ? <p role="status" className="notice">{success}</p> : null}
      {runtimes === null && !error ? <p aria-busy="true">Loading runtimes…</p> : null}
      {runtimes?.length === 0 ? <div className="empty-state"><strong>No Work runtimes are registered for this organization.</strong><span>Enroll an authorized runtime before browser execution can be dispatched.</span></div> : null}
      {runtimes?.length ? <div className="work-card-grid">{runtimes.map((runtime) => {
        const displayStatus = runtimeDisplayStatus(runtime);
        return (
          <article className="execution-panel" key={runtime.id}>
            <p className="eyebrow">{labelKind(runtime.kind)}</p>
            <h2>{runtime.label}</h2>
            <p>Status: <strong>{displayStatus}</strong></p>
            <p>Last heartbeat: <strong>{runtime.lastSeenAt || 'Never'}</strong></p>
            {displayStatus === 'stale' ? <p className="notice">Heartbeat is older than the canonical 120-second readiness window; this runtime is not eligible for dispatch.</p> : null}
            <h3>Capabilities</h3>
            {runtime.capabilities.length ? <ul>{runtime.capabilities.map((capability) => <li key={capability}><code>{capability}</code></li>)}</ul> : <p>No capabilities are registered.</p>}
          </article>
        );
      })}</div> : null}
    </section>
  );
}
