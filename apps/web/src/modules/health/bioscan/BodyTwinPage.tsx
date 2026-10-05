import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { loadBioScanWorkspace, type BodyTwinSnapshotView } from './bioscanRepository';
import './bioscan.css';

type ViewState = 'loading' | 'ready' | 'error';

function formatValue(value: unknown) {
  if (value === null || value === undefined) return 'Unavailable';
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

export function BodyTwinPage() {
  const [state, setState] = useState<ViewState>('loading');
  const [snapshots, setSnapshots] = useState<BodyTwinSnapshotView[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    void loadBioScanWorkspace()
      .then((workspace) => {
        if (cancelled) return;
        setSnapshots(workspace.snapshots);
        setSelectedId(workspace.snapshots[0]?.id || null);
        setState('ready');
      })
      .catch((cause) => {
        if (cancelled) return;
        setError(cause instanceof Error ? cause.message : 'bioscan_timeline_failed');
        setState('error');
      });
    return () => { cancelled = true; };
  }, []);

  const selected = useMemo(
    () => snapshots.find((item) => item.id === selectedId) || null,
    [selectedId, snapshots]
  );

  return (
    <section className="bioscan-page body-twin-page">
      <header className="bioscan-hero">
        <div>
          <p className="eyebrow">ATLAS Health · BioScan</p>
          <h1>Human Digital Twin</h1>
          <p>Immutable scan history. Every visible field comes from a saved BioScan snapshot; absent geometry or measurements remain absent.</p>
        </div>
        <Link to="/health/bioscan">Back to BioScan</Link>
      </header>

      <div className="bioscan-truth" role="note">
        <strong>Historical evidence, not a synthetic body claim</strong>
        <span>A snapshot records what the capture workflow actually persisted. No unmeasured metric is reconstructed for presentation.</span>
      </div>

      {state === 'loading' ? <div className="bioscan-state"><strong>Loading authorized Body Twin history</strong></div> : null}
      {state === 'error' ? (
        <div className="bioscan-error" role="alert">
          <strong>Body Twin unavailable</strong>
          <span>{error}</span>
          <small>No snapshot or body metric is inferred while the authorized source is unavailable.</small>
        </div>
      ) : null}

      {state === 'ready' && snapshots.length === 0 ? (
        <div className="bioscan-empty">
          <strong>No saved body snapshots</strong>
          <p>Complete a consented BioScan session to create immutable history. Until then, ATLAS shows no avatar or body measurements.</p>
          <Link to="/health/bioscan">Open BioScan</Link>
        </div>
      ) : null}

      {state === 'ready' && snapshots.length > 0 ? (
        <section className="body-twin-layout">
          <aside className="body-twin-timeline" aria-label="Body Twin snapshot timeline">
            <div><p className="eyebrow">Timeline</p><h2>Saved snapshots</h2></div>
            {snapshots.map((snapshot, index) => (
              <button
                type="button"
                key={snapshot.id}
                aria-label={`Snapshot ${index + 1} — ${snapshot.capturedAt}`}
                data-active={snapshot.id === selectedId}
                onClick={() => setSelectedId(snapshot.id)}
              >
                <strong>Snapshot {index + 1}</strong>
                <span>{new Date(snapshot.capturedAt).toLocaleString()}</span>
                <small>{snapshot.captureMode}</small>
              </button>
            ))}
          </aside>

          <div className="body-twin-detail">
            {selected ? (
              <>
                <header>
                  <div><p className="eyebrow">Immutable snapshot</p><h2>{selected.id}</h2></div>
                  <span>{new Date(selected.capturedAt).toLocaleString()}</span>
                </header>
                <div className="body-twin-facts">
                  <article><span>Session</span><strong>{selected.sessionId}</strong></article>
                  <article><span>Capture mode</span><strong>{selected.captureMode}</strong></article>
                  <article><span>Geometry version</span><strong>{selected.geometryVersion}</strong></article>
                  <article><span>Coordinate system</span><strong>{selected.coordinateSystem}</strong></article>
                  <article><span>Mesh</span><strong>{selected.meshRef || 'Not stored'}</strong></article>
                  <article><span>Measurements</span><strong>Not measured</strong></article>
                </div>
                <section className="body-twin-evidence">
                  <div>
                    <h3>Source summary</h3>
                    <pre>{JSON.stringify(selected.sourceSummary, null, 2)}</pre>
                  </div>
                  <div>
                    <h3>Confidence summary</h3>
                    <pre>{JSON.stringify(selected.confidenceSummary, null, 2)}</pre>
                  </div>
                </section>
                <table className="body-twin-table">
                  <caption>Accessible snapshot metadata</caption>
                  <tbody>
                    <tr><th scope="row">Captured at</th><td>{selected.capturedAt}</td></tr>
                    <tr><th scope="row">Capture mode</th><td>{selected.captureMode}</td></tr>
                    <tr><th scope="row">Geometry version</th><td>{selected.geometryVersion}</td></tr>
                    <tr><th scope="row">Coordinate system</th><td>{selected.coordinateSystem}</td></tr>
                    {Object.entries(selected.sourceSummary).map(([key, value]) => (
                      <tr key={`source-${key}`}><th scope="row">source.{key}</th><td>{formatValue(value)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </>
            ) : null}
          </div>
        </section>
      ) : null}
    </section>
  );
}
