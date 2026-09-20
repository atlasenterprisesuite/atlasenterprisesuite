import { FormEvent, useCallback, useEffect, useState } from 'react';
import { enrollWorkRuntime, listWorkRuntimes, type WorkRuntimeSummary } from './api';
import { WorkSubnav } from './WorkSubnav';

const HEARTBEAT_MAX_AGE_MS = 120_000;

function labelKind(kind: WorkRuntimeSummary['kind']) { return kind.replaceAll('_', ' '); }
function runtimeDisplayStatus(runtime: WorkRuntimeSummary) {
  if (runtime.status === 'revoked') return 'revoked';
  if (runtime.status !== 'online') return runtime.status;
  if (!runtime.lastSeenAt) return 'stale';
  const lastSeen = Date.parse(runtime.lastSeenAt);
  return Number.isFinite(lastSeen) && Date.now() - lastSeen <= HEARTBEAT_MAX_AGE_MS ? 'online' : 'stale';
}

export function WorkRuntimesPage() {
  const [runtimes, setRuntimes] = useState<WorkRuntimeSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [kind, setKind] = useState<WorkRuntimeSummary['kind']>('self_hosted');
  const [label, setLabel] = useState('');
  const [capabilities, setCapabilities] = useState('');
  const [enrolling, setEnrolling] = useState(false);
  const [oneTimeToken, setOneTimeToken] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try { setRuntimes(await listWorkRuntimes()); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'work_runtimes_unavailable'); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  const enroll = async (event: FormEvent) => {
    event.preventDefault();
    if (!label.trim() || enrolling) return;
    setEnrolling(true); setError(null); setOneTimeToken(null);
    try {
      const result = await enrollWorkRuntime({ kind, label: label.trim(), capabilities: capabilities.split(',').map((value) => value.trim()).filter(Boolean) });
      const token = typeof result.runtime_token === 'string' ? result.runtime_token : typeof result.token === 'string' ? result.token : null;
      if (!token) throw new Error('work_runtime_token_missing');
      setOneTimeToken(token); setLabel(''); setCapabilities('');
      await refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'work_runtime_enroll_failed'); }
    finally { setEnrolling(false); }
  };

  return (
    <section className="work-page page-stack">
      <header className="page-header"><p className="eyebrow">ATLAS Work Soberano</p><h1>Runtimes</h1><p>Enroll authorized execution workers. Readiness requires a heartbeat no older than 120 seconds.</p></header>
      <WorkSubnav />
      <form className="execution-panel work-config-grid" onSubmit={(event) => void enroll(event)}>
        <label><span>Runtime kind</span><select value={kind} onChange={(event) => setKind(event.target.value as WorkRuntimeSummary['kind'])}><option value="local">Local</option><option value="self_hosted">Self-hosted</option><option value="cloud_ephemeral">Cloud ephemeral</option></select></label>
        <label><span>Label</span><input value={label} maxLength={100} onChange={(event) => setLabel(event.target.value)} required /></label>
        <label><span>Capabilities</span><input value={capabilities} onChange={(event) => setCapabilities(event.target.value)} placeholder="browser, shell, provider.api" /></label>
        <button className="execution-action" type="submit" disabled={enrolling}>{enrolling ? 'Enrolling…' : 'Enroll runtime'}</button>
      </form>
      {oneTimeToken ? <aside className="execution-panel" role="status"><h2>One-time runtime token</h2><p>Copy this token now. ATLAS will not display it again.</p><code>{oneTimeToken}</code><button type="button" onClick={() => setOneTimeToken(null)}>I saved it</button></aside> : null}
      {error ? <div role="alert" className="work-error">{error}</div> : null}
      {runtimes === null && !error ? <p aria-busy="true">Loading runtimes…</p> : null}
      {runtimes?.length === 0 ? <div className="empty-state"><strong>No Work runtimes are registered for this organization.</strong><span>Enroll an authorized runtime before browser execution can be dispatched.</span></div> : null}
      {runtimes?.length ? <div className="work-card-grid">{runtimes.map((runtime) => {
        const displayStatus = runtimeDisplayStatus(runtime);
        return <article className="execution-panel" key={runtime.id}><p className="eyebrow">{labelKind(runtime.kind)}</p><h2>{runtime.label}</h2><p>Status: <strong>{displayStatus}</strong></p><p>Last heartbeat: <strong>{runtime.lastSeenAt || 'Never'}</strong></p><h3>Capabilities</h3>{runtime.capabilities.length ? <ul>{runtime.capabilities.map((capability) => <li key={capability}><code>{capability}</code></li>)}</ul> : <p>No capabilities are registered.</p>}</article>;
      })}</div> : null}
    </section>
  );
}
