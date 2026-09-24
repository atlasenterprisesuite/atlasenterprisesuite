import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ATLAS_MODULES, type AtlasModuleReadiness } from '../registry';

const READINESS_LABELS: Record<AtlasModuleReadiness, string> = {
  implemented: 'Implemented',
  partial: 'Integrated / partial',
  'external-gated': 'External gate'
};

export function AtlasSuitePage() {
  const [query, setQuery] = useState('');
  const [readiness, setReadiness] = useState<'all' | AtlasModuleReadiness>('all');
  const [area, setArea] = useState('all');

  const areas = useMemo(
    () => Array.from(new Set(ATLAS_MODULES.map((module) => module.area))).sort(),
    []
  );

  const filteredModules = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return ATLAS_MODULES.filter((module) => {
      const matchesQuery = !normalizedQuery
        || [module.title, module.navLabel, module.area, module.description, module.route]
          .some((value) => value.toLowerCase().includes(normalizedQuery));
      const matchesReadiness = readiness === 'all' || module.readiness === readiness;
      const matchesArea = area === 'all' || module.area === area;
      return matchesQuery && matchesReadiness && matchesArea;
    });
  }, [area, query, readiness]);

  const implemented = ATLAS_MODULES.filter((module) => module.readiness === 'implemented').length;
  const partial = ATLAS_MODULES.filter((module) => module.readiness === 'partial').length;
  const externalGated = ATLAS_MODULES.filter((module) => module.readiness === 'external-gated').length;

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
        <article><span>Registered modules</span><strong>{ATLAS_MODULES.length}</strong><small>One canonical registry</small></article>
        <article><span>Implemented</span><strong>{implemented}</strong><small>Verified application slices</small></article>
        <article><span>Integrated / partial</span><strong>{partial}</strong><small>Usable with explicit boundaries</small></article>
        <article><span>External gates</span><strong>{externalGated}</strong><small>Provider verification required</small></article>
      </div>

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
              <option value="implemented">Implemented</option>
              <option value="partial">Integrated / partial</option>
              <option value="external-gated">External gate</option>
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
        production data and regulated workflows remain unavailable until their own verification gates pass.
      </div>
    </section>
  );
}
