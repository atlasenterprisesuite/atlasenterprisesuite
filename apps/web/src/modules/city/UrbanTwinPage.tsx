import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  loadUrbanTwinSnapshot,
  summarizeUrbanTwin,
  type UrbanTwinBinding,
  type UrbanTwinEntity,
  type UrbanTwinSnapshot
} from './urbanTwinRepository';
import { UrbanTwinIntakePanel } from './UrbanTwinIntakePanel';
import './urbanTwin.css';

const ENTITY_ORDER = ['district', 'site', 'building', 'floor', 'space', 'asset', 'infrastructure'] as const;

const INTEGRATION_LINKS = [
  { type: 'cleanscan', label: 'CleanScan 3D', to: '/city/twin', detail: 'Digital-twin intake adapter; no connected scanner is claimed without a verified binding.' },
  { type: 'device', label: 'Device OS', to: '/device-os', detail: 'Device DNA and edge-device control remain governed by Device OS.' },
  { type: 'gps', label: 'GPS 4D', to: '/gps', detail: 'Location and navigation remain canonical in GPS 4D.' },
  { type: 'work', label: 'ATLAS Work', to: '/work', detail: 'Maintenance and field execution hand off to Work rather than duplicating task state.' }
] as const;

function EntityRow({ entity }: { entity: UrbanTwinEntity }) {
  const position = entity.latitude !== null && entity.longitude !== null
    ? `${entity.latitude.toFixed(5)}, ${entity.longitude.toFixed(5)}`
    : 'No verified coordinates';
  return (
    <article className="urban-twin-entity-row">
      <div>
        <span>{entity.entity_type}</span>
        <strong>{entity.name}</strong>
        <small>{entity.source_kind} · {position}</small>
      </div>
      <div className="urban-twin-row-state">
        <span data-state={entity.verification_state}>{entity.verification_state}</span>
        <small>{entity.lifecycle_state}</small>
      </div>
    </article>
  );
}

function BindingRow({ binding, entityName }: { binding: UrbanTwinBinding; entityName: string }) {
  return (
    <article className="urban-twin-binding-row">
      <div>
        <span>{binding.binding_type}</span>
        <strong>{entityName}</strong>
        <small>{binding.adapter} · {binding.external_ref}</small>
      </div>
      <span className="urban-twin-binding-state" data-state={binding.verification_state}>
        {binding.verification_state}
      </span>
    </article>
  );
}

export function UrbanTwinPage() {
  const [snapshot, setSnapshot] = useState<UrbanTwinSnapshot | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setState('loading');
    setError('');
    try {
      const next = await loadUrbanTwinSnapshot();
      setSnapshot(next);
      setState('ready');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'urban_twin_load_failed');
      setState('error');
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const summary = snapshot ? summarizeUrbanTwin(snapshot) : null;
  const entityById = useMemo(() => new Map((snapshot?.entities || []).map((entity) => [entity.id, entity.name])), [snapshot]);
  const counts = useMemo(() => {
    const rows = snapshot?.entities || [];
    return ENTITY_ORDER.map((type) => ({ type, count: rows.filter((entity) => entity.entity_type === type).length }));
  }, [snapshot]);

  return (
    <section className="urban-twin-page">
      <header className="urban-twin-hero">
        <div>
          <p className="eyebrow">ATLAS Digital City · Urban Twin Core</p>
          <h1>Physical reality, represented with evidence</h1>
          <p>
            Canonical hierarchy for districts, facilities, spaces and assets. The browser is read-only;
            registration, bindings and telemetry ingestion remain governed server operations.
          </p>
        </div>
        <div className="urban-twin-hero-actions">
          <Link to="/city">Back to Digital District</Link>
          <Link to="/gps">Open GPS 4D</Link>
        </div>
      </header>

      <div className="urban-twin-truth-boundary">
        <strong>Truth boundary</strong>
        <span>“Verified” means an explicit verified entity or binding. “Authenticated” observations are never inferred from UI state.</span>
      </div>

      {state === 'loading' ? <div className="urban-twin-state-card">Loading organization-scoped Urban Twin state…</div> : null}
      {state === 'error' ? (
        <div className="urban-twin-state-card error">
          <strong>Urban Twin backend unavailable</strong>
          <span>{error || 'The data source did not respond.'}</span>
          <small>No live building, device or telemetry state is inferred.</small>
        </div>
      ) : null}

      {state === 'ready' && snapshot && summary ? (
        <>
          <section className="urban-twin-metrics" aria-label="Urban Twin live repository metrics">
            <article><strong>{summary.entities}</strong><span>registered entities</span></article>
            <article><strong>{summary.verifiedEntities}</strong><span>verified entities</span></article>
            <article><strong>{summary.bindings}</strong><span>external bindings</span></article>
            <article><strong>{summary.verifiedBindings}</strong><span>verified bindings</span></article>
            <article><strong>{summary.authenticatedObservations}</strong><span>authenticated observations</span></article>
            <article><strong>{summary.simulatedObservations}</strong><span>simulation observations</span></article>
          </section>

          <UrbanTwinIntakePanel entities={snapshot.entities} bindings={snapshot.bindings} onChanged={refresh} />

          <section className="urban-twin-layout">
            <div className="urban-twin-main">
              <section className="urban-twin-card">
                <div className="urban-twin-heading">
                  <div><p className="eyebrow">Hierarchy</p><h2>District → Site → Building → Space → Asset</h2></div>
                  <span>RLS · organization scoped</span>
                </div>
                <div className="urban-twin-type-grid">
                  {counts.map((item) => <div key={item.type}><strong>{item.count}</strong><span>{item.type}</span></div>)}
                </div>
                {snapshot.entities.length ? (
                  <div className="urban-twin-entity-list">
                    {snapshot.entities.map((entity) => <EntityRow key={entity.id} entity={entity} />)}
                  </div>
                ) : (
                  <div className="urban-twin-empty">
                    <strong>No registered twin entities</strong>
                    <p>The Urban Twin Core is active, but no organization asset has been registered as a real twin yet.</p>
                  </div>
                )}
              </section>

              <section className="urban-twin-card">
                <div className="urban-twin-heading">
                  <div><p className="eyebrow">Evidence stream</p><h2>Latest observations</h2></div>
                  <span>max 40</span>
                </div>
                {snapshot.observations.length ? (
                  <div className="urban-twin-observation-list">
                    {snapshot.observations.map((observation) => (
                      <article key={observation.id}>
                        <div>
                          <span>{observation.observation_type}</span>
                          <strong>{observation.metric_key}</strong>
                          <small>{entityById.get(observation.entity_id) || 'Registered entity'} · {new Date(observation.observed_at).toLocaleString()}</small>
                        </div>
                        <span data-provenance={observation.provenance}>{observation.provenance}</span>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="urban-twin-empty">
                    <strong>No observations received</strong>
                    <p>No telemetry, inspection or maintenance observation is represented as live.</p>
                  </div>
                )}
              </section>
            </div>

            <aside className="urban-twin-side">
              <section className="urban-twin-card">
                <div className="urban-twin-heading">
                  <div><p className="eyebrow">Bindings</p><h2>External evidence</h2></div>
                </div>
                {snapshot.bindings.length ? (
                  <div className="urban-twin-binding-list">
                    {snapshot.bindings.map((binding) => (
                      <BindingRow
                        key={binding.id}
                        binding={binding}
                        entityName={entityById.get(binding.entity_id) || 'Registered entity'}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="urban-twin-empty compact">
                    <strong>No verified adapters</strong>
                    <p>CleanScan, sensors and devices remain disconnected until a binding is registered and verified.</p>
                  </div>
                )}
              </section>

              <section className="urban-twin-card">
                <div className="urban-twin-heading">
                  <div><p className="eyebrow">Canonical handoffs</p><h2>Reuse existing ATLAS modules</h2></div>
                </div>
                <div className="urban-twin-integration-list">
                  {INTEGRATION_LINKS.map((item) => {
                    const matching = snapshot.bindings.filter((binding) => binding.binding_type === item.type);
                    const verified = matching.some((binding) => binding.verification_state === 'verified');
                    return (
                      <Link key={item.label} to={item.to}>
                        <span><strong>{item.label}</strong><small>{item.detail}</small></span>
                        <span data-state={verified ? 'verified' : 'gated'}>{verified ? 'verified' : 'gated'}</span>
                      </Link>
                    );
                  })}
                </div>
              </section>

              <section className="urban-twin-card urban-twin-reference">
                <p className="eyebrow">Simulation reference</p>
                <h2>Lake Eola pilot</h2>
                <p>
                  The Digital District map may continue to show explicitly labeled simulation points.
                  Those points are not inserted into this live repository automatically.
                </p>
                <Link to="/city">Open simulation surface</Link>
              </section>
            </aside>
          </section>
        </>
      ) : null}
    </section>
  );
}
