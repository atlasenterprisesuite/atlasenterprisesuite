import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ATLAS_MODULES, type AtlasModuleReadiness } from '../registry';
import { buildAtlasPortfolio, type AtlasPortfolioDisposition } from '../release/portfolio';
import './atlas-suite.css';

const READINESS_LABELS: Record<AtlasModuleReadiness, string> = {
  implemented: 'Integrated',
  partial: 'Integrated / partial',
  'external-gated': 'Pending external gate'
};

const READINESS_FILTERS: readonly { value: 'all' | AtlasModuleReadiness; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'implemented', label: 'Operational' },
  { value: 'partial', label: 'Partial' },
  { value: 'external-gated', label: 'External Gate' }
];

const COVER_ASSETS = [
  '/atlas/design/atlas-module-gallery.webp',
  '/atlas/design/atlas-universe.webp',
  '/atlas/design/atlas-main-dashboard.webp',
  '/atlas/design/atlas-voice.webp'
] as const;

type PrimarySystemDefinition = {
  label: string;
  eyebrow: string;
  moduleId?: string;
  route?: string;
  title?: string;
  description?: string;
  cover: number;
};

const PRIMARY_SYSTEMS: readonly PrimarySystemDefinition[] = [
  { label: 'AI', eyebrow: 'Intelligence', moduleId: 'assistant', cover: 0 },
  {
    label: 'Enterprise',
    eyebrow: 'Operations',
    route: '/suite',
    title: 'ATLAS Enterprise Suite',
    description: 'Canonical product library for every governed ATLAS domain and workspace.',
    cover: 2
  },
  { label: 'Finance', eyebrow: 'Capital', moduleId: 'finance', cover: 0 },
  { label: 'Network', eyebrow: 'Communications', moduleId: 'connect', cover: 3 },
  { label: 'Spatial', eyebrow: 'Navigation', moduleId: 'galaxy', cover: 1 },
  { label: 'Health', eyebrow: 'Research', moduleId: 'health', cover: 0 },
  { label: 'Business', eyebrow: 'Operations', moduleId: 'business', cover: 2 },
  { label: 'Creator', eyebrow: 'Studio', moduleId: 'studio', cover: 0 },
  { label: 'Cloud', eyebrow: 'Platform', moduleId: 'cloud', cover: 1 }
];

export function AtlasSuitePage() {
  const [query, setQuery] = useState('');
  const [readiness, setReadiness] = useState<'all' | AtlasModuleReadiness>('all');
  const [convergence, setConvergence] = useState<'all' | AtlasPortfolioDisposition>('all');
  const [area, setArea] = useState('all');

  const portfolio = useMemo(() => buildAtlasPortfolio(ATLAS_MODULES), []);
  const portfolioByModule = useMemo(
    () => new Map(portfolio.map((decision) => [decision.moduleId, decision] as const)),
    [portfolio]
  );

  const areas = useMemo(
    () => Array.from(new Set(ATLAS_MODULES.map((module) => module.area))).sort(),
    []
  );

  const primarySystems = useMemo(() => PRIMARY_SYSTEMS.flatMap((definition) => {
    const module = definition.moduleId
      ? ATLAS_MODULES.find((candidate) => candidate.id === definition.moduleId)
      : undefined;
    const route = module?.route ?? definition.route;
    if (!route) return [];

    return [{
      ...definition,
      route,
      title: module?.title ?? definition.title ?? definition.label,
      description: module?.description ?? definition.description ?? '',
      readiness: module?.readiness,
      evolution: module?.evolution
    }];
  }), []);

  const filteredModules = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return ATLAS_MODULES.filter((module) => {
      const matchesQuery = !normalizedQuery
        || [module.title, module.navLabel, module.area, module.description, module.route]
          .some((value) => value.toLowerCase().includes(normalizedQuery));
      const matchesReadiness = readiness === 'all' || module.readiness === readiness;
      const matchesConvergence = convergence === 'all'
        || portfolioByModule.get(module.id)?.disposition === convergence;
      const matchesArea = area === 'all' || module.area === area;
      return matchesQuery && matchesReadiness && matchesConvergence && matchesArea;
    }).sort((left, right) => left.title.localeCompare(right.title));
  }, [area, convergence, portfolioByModule, query, readiness]);

  const implemented = ATLAS_MODULES.filter((module) => module.readiness === 'implemented').length;
  const activeEvolution = ATLAS_MODULES.filter((module) => module.evolution === 'active').length;
  const externalGated = ATLAS_MODULES.filter((module) => module.readiness === 'external-gated').length;
  const kept = portfolio.filter((item) => item.disposition === 'keep').length;
  const merged = portfolio.filter((item) => item.disposition === 'merge').length;

  return (
    <section className="page-stack atlas-suite-page">
      <header className="suite-hero">
        <div className="suite-hero-backdrop" aria-hidden="true" />
        <div className="suite-hero-content">
          <p className="eyebrow">ATLAS Enterprise Suite</p>
          <h1>ATLAS Suite A-Z</h1>
          <p className="suite-hero-copy">
            Discover, enter and continue across every canonical ATLAS system from one visual product library.
            Operational baseline and active evolution are independent lifecycle axes; external readiness remains fail-closed.
          </p>

          <label className="suite-search">
            <span>Search modules</span>
            <div className="suite-search-control">
              <span aria-hidden="true">⌕</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search Accounting, AI, People, Voice, Ride, CRM..."
                type="search"
              />
            </div>
          </label>

          <div className="suite-status-strip" aria-label="ATLAS module readiness summary">
            <span><strong>{ATLAS_MODULES.length}</strong> modules</span>
            <span><strong>{implemented}</strong> operational baseline</span>
            <span><strong>{activeEvolution}</strong> active evolution</span>
            <span><strong>{externalGated}</strong> gated</span>
            <span><strong>{kept}</strong> canonical owners</span>
            <span><strong>{merged}</strong> converged capabilities</span>
          </div>
        </div>
      </header>

      <section className="suite-section" aria-labelledby="primary-systems-heading">
        <div className="suite-section-heading">
          <div>
            <p className="eyebrow">Primary Systems</p>
            <h2 id="primary-systems-heading">Enter ATLAS by capability</h2>
          </div>
          <p>Visual entry points resolve to the same canonical routes used across ATLAS.</p>
        </div>

        <nav className="suite-primary-grid" aria-label="ATLAS primary systems">
          {primarySystems.map((system) => (
            <Link className="suite-primary-card" to={system.route} key={system.label}>
              <img src={COVER_ASSETS[system.cover % COVER_ASSETS.length]} alt="" aria-hidden="true" loading="lazy" decoding="async" />
              <span className="suite-card-shade" aria-hidden="true" />
              <span className="suite-primary-copy">
                <small>{system.eyebrow}</small>
                <strong>{system.label}</strong>
                <span>{system.title}</span>
                {system.readiness ? (
                  <em className={`suite-readiness-chip ${system.readiness}`}>
                    {READINESS_LABELS[system.readiness]}{system.evolution === 'active' ? ' · Active evolution' : ''}
                  </em>
                ) : null}
              </span>
              <span className="suite-open-mark" aria-hidden="true">↗</span>
            </Link>
          ))}
        </nav>
      </section>

      <section className="suite-section suite-directory" id="explore-a-z" aria-labelledby="explore-a-z-heading">
        <div className="suite-section-heading">
          <div>
            <p className="eyebrow">Explore A-Z</p>
            <h2 id="explore-a-z-heading">All registered modules</h2>
          </div>
          <p>Browse the canonical registry with its rebirth decision: keep a distinct owner or converge the capability into a stronger ATLAS system.</p>
        </div>

        <div className="suite-filter-bar" aria-label="Filter ATLAS modules">
          <div className="suite-filter-chips" aria-label="Readiness filters">
            {READINESS_FILTERS.map((filter) => (
              <button
                key={filter.value}
                type="button"
                className={readiness === filter.value ? 'is-active' : ''}
                aria-pressed={readiness === filter.value}
                onClick={() => setReadiness(filter.value)}
              >
                {filter.label}
              </button>
            ))}
          </div>

          <label className="suite-area-filter">
            <span>Convergence</span>
            <select value={convergence} onChange={(event) => setConvergence(event.target.value as 'all' | AtlasPortfolioDisposition)}>
              <option value="all">All decisions</option>
              <option value="keep">Canonical owners</option>
              <option value="merge">Merged capabilities</option>
              <option value="compatibility">Compatibility</option>
              <option value="retire">Retired</option>
            </select>
          </label>

          <label className="suite-area-filter">
            <span>Area</span>
            <select value={area} onChange={(event) => setArea(event.target.value)}>
              <option value="all">All areas</option>
              {areas.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>

          <label className="suite-filter-search">
            <span className="sr-only">Search modules</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Filter modules..."
              type="search"
            />
          </label>

          <span className="suite-result-count" aria-live="polite">{filteredModules.length} results</span>
        </div>

        {filteredModules.length ? (
          <div className="suite-module-grid" aria-label="ATLAS A-Z modules">
            {filteredModules.map((module, index) => {
              const decision = portfolioByModule.get(module.id);
              const owner = decision?.ownerModuleId
                ? ATLAS_MODULES.find((candidate) => candidate.id === decision.ownerModuleId)
                : null;
              return (
              <Link className="suite-module-card" to={module.route} key={module.id}>
                <span className="suite-module-cover">
                  <img
                    src={COVER_ASSETS[index % COVER_ASSETS.length]}
                    alt=""
                    aria-hidden="true"
                    loading="lazy"
                    decoding="async"
                  />
                  <span className="suite-card-shade" aria-hidden="true" />
                  <span className={`suite-readiness-chip ${module.readiness}`}>
                    {READINESS_LABELS[module.readiness]}{module.evolution === 'active' ? ' · Active evolution' : ''}
                  </span>
                  {decision ? (
                    <span className={`suite-convergence-chip ${decision.disposition}`}>
                      {decision.disposition === 'merge' && owner
                        ? `Integrated into ${owner.navLabel}`
                        : decision.disposition === 'keep'
                          ? 'Canonical owner'
                          : decision.disposition}
                    </span>
                  ) : null}
                </span>
                <span className="suite-module-copy">
                  <small>{module.area}</small>
                  <strong>{module.title}</strong>
                  <p>{module.description}</p>
                  <span className="suite-module-meta">
                    <span>{module.requiresAuth ? 'ATLAS Identity' : 'Public entry'}</span>
                    <span className="suite-module-open">Open <span aria-hidden="true">↗</span></span>
                  </span>
                </span>
              </Link>
              );
            })}
          </div>
        ) : (
          <div className="empty-state suite-empty-state">
            <strong>No modules match these filters</strong>
            <span>Change the search, area or readiness filter.</span>
          </div>
        )}
      </section>

      <div className="notice strong suite-governance-note">
        Rebirth does not delete verified capability. “Canonical owner” means the system keeps a distinct product/domain boundary.
        “Integrated into …” means the route remains compatible while ownership converges into a stronger ATLAS family. Readiness, provider
        authorization and Production Verified remain separate evidence-backed states; this portfolio decision never upgrades them by itself.
      </div>
    </section>
  );
}
