import { useEffect, useState } from 'react';
import { enrollWorkRuntime, listWorkRuntimes, type WorkRuntimeSummary } from './api';
import { WorkSubnav } from './WorkSubnav';

function labelKind(kind: WorkRuntimeSummary['kind']) {
  return kind.replaceAll('_', ' ');
}

type BrowserEnrollment = {
  runtimeId: string;
  runtimeToken: string;
};

export function WorkRuntimesPage() {
  const [runtimes, setRuntimes] = useState<WorkRuntimeSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [enrolling, setEnrolling] = useState(false);
  const [browserEnrollment, setBrowserEnrollment] = useState<BrowserEnrollment | null>(null);
  const [copied, setCopied] = useState(false);

  async function loadRuntimes() {
    setError(null);
    try {
      setRuntimes(await listWorkRuntimes());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'work_runtimes_unavailable');
    }
  }

  useEffect(() => {
    let active = true;
    void listWorkRuntimes()
      .then((rows) => { if (active) setRuntimes(rows); })
      .catch((caught) => { if (active) setError(caught instanceof Error ? caught.message : 'work_runtimes_unavailable'); });
    return () => { active = false; };
  }, []);

  async function enrollBrowserRuntime() {
    setEnrolling(true);
    setError(null);
    setCopied(false);
    try {
      const result = await enrollWorkRuntime({
        kind: 'local',
        label: 'ATLAS Governed Browser',
        capabilities: ['browser']
      });
      const runtime = result.runtime && typeof result.runtime === 'object' ? result.runtime as Record<string, unknown> : {};
      const runtimeId = String(runtime.id || '');
      const runtimeToken = String(result.runtime_token || '');
      if (!runtimeId || !runtimeToken) throw new Error('work_runtime_enrollment_invalid');
      setBrowserEnrollment({ runtimeId, runtimeToken });
      await loadRuntimes();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'work_runtime_enrollment_failed');
    } finally {
      setEnrolling(false);
    }
  }

  function setupText(enrollment: BrowserEnrollment) {
    return [
      `ATLAS_WORK_RUNTIME_ID=${enrollment.runtimeId}`,
      `ATLAS_WORK_RUNTIME_TOKEN=${enrollment.runtimeToken}`,
      'ATLAS_BROWSER_CDP_URL=http://127.0.0.1:9222',
      'node tools/local-agent/atlas-work-browser-runtime.mjs'
    ].join('\n');
  }

  async function copySetup() {
    if (!browserEnrollment || !navigator.clipboard) return;
    await navigator.clipboard.writeText(setupText(browserEnrollment));
    setCopied(true);
  }

  return (
    <section className="work-page page-stack">
      <header className="page-header"><p className="eyebrow">ATLAS Work Soberano</p><h1>Runtimes</h1><p>Authorized Local, Self-Hosted and Cloud Ephemeral execution workers. No runtime is shown as online without a current heartbeat.</p></header>
      <WorkSubnav />

      <article className="execution-panel">
        <p className="eyebrow">Governed browser</p>
        <h2>Browser Action Bridge</h2>
        <p>Enroll a local browser runtime that can execute envelope-scoped navigation, reading, typing and clicks. OAuth consent requires a separate approved ATLAS execution decision.</p>
        <button type="button" onClick={() => void enrollBrowserRuntime()} disabled={enrolling}>
          {enrolling ? 'Enrolling…' : 'Enroll Browser Runtime'}
        </button>
        {browserEnrollment ? (
          <div className="page-stack" role="status">
            <strong>Runtime enrolled. Save this token now; ATLAS will not show it again.</strong>
            <pre><code>{setupText(browserEnrollment)}</code></pre>
            <div>
              <button type="button" onClick={() => void copySetup()}>{copied ? 'Copied' : 'Copy setup'}</button>{' '}
              <button type="button" onClick={() => setBrowserEnrollment(null)}>Dismiss token</button>
            </div>
            <p>Use a dedicated Chrome/Chromium profile with remote debugging bound to <code>127.0.0.1:9222</code>. Do not expose the debugging port to the network.</p>
          </div>
        ) : null}
      </article>

      {error ? <div role="alert" className="work-error">{error}</div> : null}
      {runtimes === null && !error ? <p aria-busy="true">Loading runtimes…</p> : null}
      {runtimes?.length === 0 ? <div className="empty-state"><strong>No Work runtimes are registered for this organization.</strong><span>Enroll an authorized runtime before browser execution can be dispatched.</span></div> : null}
      {runtimes?.length ? <div className="work-card-grid">{runtimes.map((runtime) => (
        <article className="execution-panel" key={runtime.id}>
          <p className="eyebrow">{labelKind(runtime.kind)}</p>
          <h2>{runtime.label}</h2>
          <p>Status: <strong>{runtime.status}</strong></p>
          <p>Last heartbeat: <strong>{runtime.lastSeenAt || 'Never'}</strong></p>
          <h3>Capabilities</h3>
          {runtime.capabilities.length ? <ul>{runtime.capabilities.map((capability) => <li key={capability}><code>{capability}</code></li>)}</ul> : <p>No capabilities are registered.</p>}
        </article>
      ))}</div> : null}
    </section>
  );
}
