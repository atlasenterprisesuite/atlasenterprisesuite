import { useEffect, useMemo, useState } from 'react';
import { CloudSubnav } from './AtlasCloudNextLevel';
import {
  clearRuntimeIncidents,
  getRuntimeIncidents,
  getRuntimeReleaseSha,
  hydrateRuntimeReleaseMetadata,
  subscribeRuntimeIncidents,
  type RuntimeIncident
} from '../../runtime/runtimeIntegrity';

function shortSha(value: string | null) {
  return value ? value.slice(0, 12) : 'Unavailable';
}

export function AtlasRuntimeIntegrityPage() {
  const [incidents, setIncidents] = useState<RuntimeIncident[]>(() => getRuntimeIncidents());
  const [releaseSha, setReleaseSha] = useState<string | null>(() => getRuntimeReleaseSha());

  useEffect(() => {
    const refresh = () => {
      setIncidents(getRuntimeIncidents());
      setReleaseSha(getRuntimeReleaseSha());
    };

    const unsubscribe = subscribeRuntimeIncidents(refresh);
    void hydrateRuntimeReleaseMetadata().then(refresh);
    return unsubscribe;
  }, []);

  const summary = useMemo(() => {
    const counts = { P0: 0, P1: 0, P2: 0, P3: 0 };
    for (const incident of incidents) counts[incident.severity] += incident.occurrenceCount;
    return counts;
  }, [incidents]);

  const applicationCount = incidents
    .filter((incident) => incident.category === 'application')
    .reduce((total, incident) => total + incident.occurrenceCount, 0);
  const externalNoise = incidents
    .filter((incident) => incident.category === 'browser_extension' || incident.category === 'compatibility')
    .reduce((total, incident) => total + incident.occurrenceCount, 0);

  return (
    <section className="atlas-cloud-page atlas-cloud-control-page atlas-runtime-integrity">
      <CloudSubnav />

      <header className="atlas-cloud-header">
        <p className="eyebrow">ATLAS Cloud · Runtime Integrity</p>
        <h1>Browser Diagnostics</h1>
        <p>
          Classify browser runtime failures by operational impact instead of treating every DevTools warning as
          a production outage. Secrets and query credentials are redacted before browser-session persistence.
        </p>
      </header>

      <section className="atlas-cloud-kpi-grid" aria-label="Runtime integrity summary">
        <article><span>P0 render failures</span><strong>{summary.P0}</strong></article>
        <article><span>P1 runtime failures</span><strong>{summary.P1}</strong></article>
        <article><span>Application events</span><strong>{applicationCount}</strong></article>
        <article><span>External browser noise</span><strong>{externalNoise}</strong></article>
      </section>

      <section className="atlas-runtime-integrity-grid">
        <article className="atlas-cloud-toolbox">
          <div>
            <p className="eyebrow">Release correlation</p>
            <h2>Current browser session</h2>
          </div>
          <dl className="atlas-runtime-definition-list">
            <div><dt>Release SHA</dt><dd><code>{shortSha(releaseSha)}</code></dd></div>
            <div><dt>Route</dt><dd><code>{window.location.pathname}</code></dd></div>
            <div><dt>Retention</dt><dd>Session only · maximum 100 incidents</dd></div>
            <div><dt>Secret handling</dt><dd>Redacted before persistence</dd></div>
          </dl>
          {!releaseSha ? (
            <p className="atlas-cloud-truth-note">
              Exact release correlation is intentionally unavailable when the protected deployment manifest cannot
              be read by this browser identity. ATLAS does not invent a commit SHA.
            </p>
          ) : null}
        </article>

        <article className="atlas-cloud-toolbox">
          <div>
            <p className="eyebrow">Classification contract</p>
            <h2>What blocks and what does not</h2>
          </div>
          <div className="atlas-runtime-contract">
            <p><strong>P0</strong><span>React render-boundary failure. Treat as release-blocking evidence when reproduced in the production verifier.</span></p>
            <p><strong>P1</strong><span>Unhandled application, provider or network runtime failure requiring investigation.</span></p>
            <p><strong>P2</strong><span>Security-policy or unclassified browser event. Review impact before promotion.</span></p>
            <p><strong>P3</strong><span>Browser-extension or compatibility noise. Never fail a release solely from this class.</span></p>
          </div>
        </article>
      </section>

      <section className="atlas-cloud-toolbox">
        <div className="atlas-cloud-section-heading">
          <div>
            <p className="eyebrow">Incident stream</p>
            <h2>Sanitized browser-session evidence</h2>
          </div>
          <button
            type="button"
            onClick={() => {
              clearRuntimeIncidents();
              setIncidents([]);
            }}
            disabled={incidents.length === 0}
          >
            Clear session incidents
          </button>
        </div>

        {incidents.length === 0 ? (
          <div className="atlas-cloud-state" role="status">
            <strong>No browser incidents captured in this session.</strong>
            <span>This is browser-session evidence only; it is not a claim that production has zero incidents.</span>
          </div>
        ) : (
          <div className="atlas-runtime-incident-list">
            {incidents.map((incident) => (
              <article key={incident.id} className={`severity-${incident.severity.toLowerCase()}`}>
                <div>
                  <span className="atlas-runtime-severity">{incident.severity}</span>
                  <strong>{incident.code}</strong>
                  <small>{incident.category} · {incident.occurrenceCount} occurrence{incident.occurrenceCount === 1 ? '' : 's'}</small>
                </div>
                <p>{incident.message}</p>
                <dl>
                  <div><dt>Route</dt><dd><code>{incident.route}</code></dd></div>
                  <div><dt>Last seen</dt><dd>{new Date(incident.lastSeenAt).toLocaleString()}</dd></div>
                  <div><dt>Release</dt><dd><code>{shortSha(incident.releaseSha)}</code></dd></div>
                  {incident.source ? <div><dt>Source</dt><dd><code>{incident.source}</code></dd></div> : null}
                </dl>
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}
