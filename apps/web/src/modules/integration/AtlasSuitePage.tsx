import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getAtlasModuleAccessSnapshot } from '../../access/moduleAccess';
import { ATLAS_MODULES, type AtlasModuleReadiness } from '../registry';

const READINESS_LABELS: Record<AtlasModuleReadiness, string> = {
  implemented: 'Integrated',
  partial: 'Integrated / partial',
  'external-gated': 'Pending external gate'
};

export function AtlasSuitePage() {
  const [query, setQuery] = useState('');
  const [readiness, setReadiness] = useState<'all' | AtlasModuleReadiness>('all');
  const [area, setArea] = useState('all');
  const [accessibleModuleIds, setAccessibleModuleIds] = useState<Set<string> | null>(null);
  const [accessError, setAccessError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setAccessError(false);
    void getAtlasModuleAccessSnapshot()
      .then((rows) => {
        if (!cancelled) setAccessibleModuleIds(new Set(rows.filter((row) => row.allowed).map((row) => row.module_id)));
      })
      .catch(() => {
        if (!cancelled) {
          setAccessibleModuleIds(new Set());
          setAccessError(true);
        }
      });
    return () => { cancelled = true; };
  }, []);

  const availableModules = useMemo(
    () => ATLAS_MODULES.filter((module) => !module.requiresAuth || Boolean(accessibleModuleIds?.has(module.id))),
    [accessibleModuleIds]
  );

  const areas = useMemo(
    () => Array.from(new Set(availableModules.map((module) => module.area))).sort(),
    [availableModules]
  );

  const filteredModules = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return availableModules.filter((module) => {
      const matchesQuery = !normalizedQuery
        || [module.title, module.navLabel, module.area, module.description, module.route]
          .some((value) => value.toLowerCase().includes(normalizedQuery));
      const matchesReadiness = readiness === 'all' || module.readiness === readiness;
      const matchesArea = area === 'all' || module.area === area;
      return matchesQuery && matchesReadiness && matchesArea;
    });
  }, [area, availableModules, query, readiness]);

  const implemented = availableModules.filter((module) => module.readiness === 'implemented').length;
  const partial = availableModules.filter((module) => module.readiness === 'partial').length;
  const externalGated = availableModules.filter((module) => module.readiness === 'external-gated').length;

  return (
    <section className="page-stack">
      <header className="page-header">
        <p className="eyebrow">ATLAS Enterprise Suite</p>
        <h1>ATLAS Suite A-Z</h1>
        <p>
          One canonical directory for every registered ATLAS domain. Routes open the current implementation;
          readiness labels remain fail-closed and never present external or incomplete capabilities as live.
        </p>
      </header>

      <div className="metric-grid" aria-label="ATLAS module readiness summary">
        <article><span>Available modules</span><strong>{availableModules.length}</strong><small>Entitlement + role filtered</small></article>
        <article><span>Integrated</span><strong>{implemented}</strong><small>Canonical application slices; production verification is separate</small></article>
        <article><span>Integrated / partial</span><strong>{partial}</strong><small>Usable with explicit boundaries</small></article>
        <article><span>Pending external gates</span><strong>{externalGated}</strong><small>Provider verification required</small></article>
      </div>

      {accessError ? <div className="notice strong" role="alert">Protected-module access could not be verified. ATLAS is showing only public entries.</div> : null}

      <section className="workspace-card" aria-label="Filter ATLAS modules">
        <div className="toolbar">
          <label className="field wide-field">
            <span>Search modules</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search Accounting, People, Voice, Ride, CRM..."
              type="search"
            />
          </label>
          <label className="field">
            <span>Area</span>
            <select value={area} onChange={(event) => setArea(event.target.value)}>
              <option value="all">All areas</option>
              {areas.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Readiness</span>
            <select
              value={readiness}
              onChange={(event) => setReadiness(event.target.value as 'all' | AtlasModuleReadiness)}
            >
              <option value="all">All states</option>
              <option value="implemented">Integrated</option>
              <option value="partial">Integrated / partial</option>
              <option value="external-gated">Pending external gate</option>
            </select>
          </label>
        </div>
      </section>

      {filteredModules.length ? (
        <div className="module-grid" aria-label="ATLAS A-Z modules">
          {filteredModules.map((module) => (
            <Link className="module-card enabled" to={module.route} key={module.id}>
              <span>{module.area} · {READINESS_LABELS[module.readiness]}</span>
              <strong>{module.title}</strong>
              <p>{module.description}</p>
              <small className="muted">
                {module.requiresAuth ? 'ATLAS Identity required' : 'Public entry'} · {module.route}
              </small>
            </Link>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <strong>No modules match these filters</strong>
          <span>Change the search, area or readiness filter.</span>
        </div>
      )}

      <div className="notice strong">
        “Integrated” describes canonical routing and governed module composition. External providers, irreversible actions,
        production data and regulated workflows remain unavailable until their own verification gates pass. A module can be Integrated while
        its production state is Pending Gate or Blocked; only current machine-verifiable gate evidence can yield Production Verified.
      </div>
    </section>
  );
}
