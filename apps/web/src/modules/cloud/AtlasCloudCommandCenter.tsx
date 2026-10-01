import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ATLAS_SESSION_EVENT,
  getCachedAtlasShellOrganization
} from '../../lib/atlasSession';
import { ATLAS_MODULES } from '../registry';
import { atlasCloudTruthBadge } from './truthStatus';

const navItems = [
  ['Overview', '/cloud'],
  ['Projects & Resources', '/cloud/resources'],
  ['Deployments', '/cloud/releases'],
  ['Databases & APIs', '/cloud/api-explorer'],
  ['Network & Domains', '/cloud/domains'],
  ['Identity & Access', '/cloud/iam'],
  ['Secrets & Config', '/cloud/config'],
  ['Automations', '/automations'],
  ['Observability', '/cloud/observability'],
  ['Security & Incidents', '/cloud/incidents'],
  ['FinOps', '/cloud/finops'],
  ['Release Control', '/release'],
  ['Production Verification', '/cloud/production-verification'],
  ['Documentation', '/cloud/docs']
] as const;

const operationActions = [
  ['Create project', '/cloud/resources', 'Create an organization-scoped project through projects.write and RLS.'],
  ['Verify domain DNS', '/cloud/domains', 'Verify public TXT evidence without claiming provider mutation access.'],
  ['Inspect API contract', '/cloud/api-explorer', 'Read the authenticated OpenAPI contract and approved read operations.'],
  ['Review releases', '/cloud/releases', 'Inspect canonical Release Control state before deployment claims.'],
  ['Verify production', '/cloud/production-verification', 'Run the evidence view for mandatory production gates.'],
  ['Open automations', '/automations', 'Enter the governed ATLAS automation surface.']
] as const;

const providers = [
  { name: 'GitHub', role: 'Canonical source + CI', required: true },
  { name: 'Supabase', role: 'Database + Auth + backend control plane', required: true },
  { name: 'Cloudflare', role: 'Public edge + DNS + runtime verification', required: true },
  { name: 'Vercel', role: 'Optional deployment adapter', required: false },
  { name: 'AWS / Azure / GCP', role: 'Optional interchangeable adapters', required: false },
  { name: 'Self-hosted', role: 'Optional sovereign runtime adapter', required: false }
] as const;

const evidenceSurfaces = [
  { label: 'Source integrity', route: '/release', authority: 'Release Control', note: 'Exact source and release evidence.' },
  { label: 'Backend readiness', route: '/execution/manager/readiness', authority: 'ATLAS Manager', note: 'Provider requirements and blockers.' },
  { label: 'Edge & DNS', route: '/cloud/domains', authority: 'Public DNS evidence', note: 'Read verification; mutations remain adapter-gated.' },
  { label: 'Security', route: '/cloud/incidents', authority: 'Incident authority', note: 'Open incidents and reliability evidence.' },
  { label: 'Production', route: '/cloud/production-verification', authority: 'Production verifier', note: 'Mandatory gates determine final status.' }
] as const;

type SearchResult = {
  label: string;
  route: string;
  detail: string;
};

function EvidenceChip({ children }: { children: string }) {
  return <span className="atlas-cloud-evidence-chip">{children}</span>;
}

export function AtlasCloudCommandCenter() {
  const modules = ATLAS_MODULES.filter((module) => module.id !== 'cloud');
  const galaxyModules = modules.slice(0, 12);
  const [query, setQuery] = useState('');
  const [organization, setOrganization] = useState(() => getCachedAtlasShellOrganization());

  useEffect(() => {
    const refresh = () => setOrganization(getCachedAtlasShellOrganization());
    refresh();
    window.addEventListener(ATLAS_SESSION_EVENT, refresh);
    return () => window.removeEventListener(ATLAS_SESSION_EVENT, refresh);
  }, []);

  const searchResults = useMemo<SearchResult[]>(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return [];

    const candidates: SearchResult[] = [
      ...navItems.map(([label, route]) => ({
        label,
        route,
        detail: 'ATLAS Cloud control surface'
      })),
      ...operationActions.map(([label, route, detail]) => ({ label, route, detail })),
      ...modules.map((module) => ({
        label: module.title,
        route: module.route,
        detail: module.description
      }))
    ];

    const seen = new Set<string>();
    return candidates
      .filter((item) =>
        item.label.toLowerCase().includes(normalized)
        || item.route.toLowerCase().includes(normalized)
        || item.detail.toLowerCase().includes(normalized)
      )
      .filter((item) => {
        const key = `${item.route}::${item.label}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 8);
  }, [modules, query]);

  return (
    <section className="atlas-cloud-os-shell" aria-label="ATLAS Cloud Command Center">
      <header className="atlas-cloud-os-topbar">
        <div className="atlas-cloud-os-brand">
          <span className="atlas-cloud-os-mark">A</span>
          <div><strong>ATLAS CLOUD</strong><small>Control Center</small></div>
        </div>

        <div className="atlas-cloud-os-context" aria-label="Current ATLAS context">
          <span>{organization?.name || 'Active ATLAS organization'}</span>
          <span>Role: {organization?.role || 'verified member'}</span>
          <span>Target: Production</span>
        </div>

        <div className="atlas-cloud-os-search-wrap">
          <label className="atlas-cloud-os-search">
            <span className="sr-only">Search ATLAS Cloud</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search resources, modules, releases, commands…"
              autoComplete="off"
            />
          </label>
          {query.trim() ? (
            <div className="atlas-cloud-os-search-results" role="listbox" aria-label="ATLAS Cloud search results">
              {searchResults.length ? searchResults.map((result) => (
                <Link key={`${result.route}-${result.label}`} to={result.route} onClick={() => setQuery('')}>
                  <strong>{result.label}</strong>
                  <span>{result.detail}</span>
                  <code>{result.route}</code>
                </Link>
              )) : (
                <div className="atlas-cloud-os-search-empty" role="status">No ATLAS Cloud results match this search.</div>
              )}
            </div>
          ) : null}
        </div>

        <div className="atlas-cloud-os-actions">
          <Link to="/cloud/production-verification">Verify production</Link>
        </div>
      </header>

      <div className="atlas-cloud-os-body">
        <aside className="atlas-cloud-os-sidebar" aria-label="ATLAS Cloud navigation">
          <nav>
            {navItems.map(([label, route], index) => (
              <Link className={index === 0 ? 'active' : ''} key={route} to={route}>{label}</Link>
            ))}
          </nav>
          <div className="atlas-cloud-os-sidebar-footer">
            <span>Truth model</span>
            <strong>Evidence-first · fail-closed</strong>
          </div>
        </aside>

        <main className="atlas-cloud-os-main">
          <section className="atlas-cloud-os-hero">
            <div>
              <p className="eyebrow">Sovereign cloud control plane</p>
              <h1>Operate ATLAS from one command surface.</h1>
              <p>
                Inspect, create, verify and recover through governed ATLAS authorities while provider-specific
                complexity remains behind authenticated adapters.
              </p>
            </div>
            <div className="atlas-cloud-os-hero-actions">
              <Link className="atlas-cloud-primary" to="/cloud/production-verification">Production Verification</Link>
              <Link to="/cloud/service-graph">Open Service Graph</Link>
            </div>
          </section>

          <section className="atlas-cloud-os-health" aria-labelledby="atlas-cloud-health-title">
            <div className="atlas-cloud-os-section-heading">
              <div><p className="eyebrow">System evidence</p><h2 id="atlas-cloud-health-title">Authoritative verification surfaces</h2></div>
              <Link to="/cloud/production-verification">View mandatory gates</Link>
            </div>
            <div className="atlas-cloud-os-health-grid">
              {evidenceSurfaces.map((item) => (
                <Link key={item.label} to={item.route} className="atlas-cloud-os-health-card">
                  <span>{item.label}</span>
                  <EvidenceChip>{item.authority}</EvidenceChip>
                  <small>{item.note}</small>
                </Link>
              ))}
            </div>
            <p className="atlas-cloud-os-muted">
              This overview does not invent green/red health. Open each authority to read live evidence.
            </p>
          </section>

          <section className="atlas-cloud-os-grid">
            <article className="atlas-cloud-os-panel atlas-cloud-os-architecture">
              <div className="atlas-cloud-os-section-heading">
                <div><p className="eyebrow">Architecture</p><h2>Canonical control path</h2></div>
                <Link to="/cloud/service-graph">Expand</Link>
              </div>
              <div className="atlas-cloud-os-control-node">
                <span>ATLAS CLOUD</span><strong>CONTROL PLANE</strong>
              </div>
              <div className="atlas-cloud-os-flow">
                <Link to="/release"><span>GitHub</span><small>Source + CI authority</small></Link>
                <Link to="/execution/manager/readiness"><span>Supabase</span><small>Backend authority</small></Link>
                <Link to="/cloud/domains"><span>Cloudflare</span><small>Public edge boundary</small></Link>
              </div>
              <div className="atlas-cloud-os-flow-arrow" aria-hidden="true">↓</div>
              <Link className="atlas-cloud-os-production-node" to="/cloud/production-verification">
                <span>Production</span>
                <small>Public runtime verification required</small>
              </Link>
            </article>

            <article className="atlas-cloud-os-panel">
              <div className="atlas-cloud-os-section-heading">
                <div><p className="eyebrow">Command Center</p><h2>Available operations</h2></div>
              </div>
              <div className="atlas-cloud-os-command-grid">
                {operationActions.map(([label, route]) => <Link key={label} to={route}>{label} →</Link>)}
              </div>
              <p className="atlas-cloud-os-muted">
                Every action above maps to an implemented surface. Provider writes remain blocked where no authorized adapter exists.
              </p>
            </article>
          </section>

          <section className="atlas-cloud-os-grid">
            <article className="atlas-cloud-os-panel">
              <div className="atlas-cloud-os-section-heading">
                <div><p className="eyebrow">Resource Explorer</p><h2>Governed hierarchy model</h2></div>
                <Link to="/cloud/resources">Open live resource manager</Link>
              </div>
              <div className="atlas-cloud-os-tree">
                <strong>{organization?.name || 'ATLAS organization'}</strong>
                <div><span>Production</span><small>Policy target · live inventory is read from Resource Manager</small></div>
                <div><span>Staging</span><small>Pre-production verification boundary</small></div>
                <div><span>Development</span><small>Isolated implementation boundary</small></div>
              </div>
              <p className="atlas-cloud-os-muted">Hierarchy labels are governance boundaries, not claims that provider resources exist.</p>
            </article>

            <article className="atlas-cloud-os-panel">
              <div className="atlas-cloud-os-section-heading">
                <div><p className="eyebrow">Providers</p><h2>Adapter registry</h2></div>
              </div>
              <div className="atlas-cloud-os-provider-list">
                {providers.map((provider) => (
                  <div key={provider.name}>
                    <span><strong>{provider.name}</strong><small>{provider.role}</small></span>
                    <b>{provider.required ? 'REQUIRED ROLE' : 'OPTIONAL SLOT'}</b>
                  </div>
                ))}
              </div>
              <p className="atlas-cloud-os-muted">
                Adapter role never means “connected.” Connectivity is accepted only when provider evidence is authenticated and current.
              </p>
            </article>
          </section>

          <section className="atlas-cloud-os-panel">
            <div className="atlas-cloud-os-section-heading">
              <div><p className="eyebrow">ATLAS Galaxy</p><h2>Connected product systems</h2></div>
              <Link to="/cloud/docs/catalog">Full catalog</Link>
            </div>
            <div className="atlas-cloud-os-galaxy">
              {galaxyModules.map((module) => {
                const truth = atlasCloudTruthBadge(module.readiness);
                return (
                  <Link key={module.id} to={module.route} className={`atlas-cloud-os-orbit ${truth.state}`}>
                    <span>{module.title}</span>
                    <small>{truth.label}</small>
                  </Link>
                );
              })}
            </div>
            <p className="atlas-cloud-os-muted">Galaxy labels reflect the canonical module registry state, not external-provider connectivity.</p>
          </section>

          <section className="atlas-cloud-os-grid atlas-cloud-os-bottom">
            <article className="atlas-cloud-os-panel">
              <div className="atlas-cloud-os-section-heading">
                <div><p className="eyebrow">Operations</p><h2>Verification checklist</h2></div>
                <Link to="/cloud/observability">Open live observability</Link>
              </div>
              <ol className="atlas-cloud-os-timeline">
                <li><span>Release</span><strong>Confirm canonical source and deployment evidence.</strong></li>
                <li><span>Security</span><strong>Keep active warnings visible until remediated or accepted through governance.</strong></li>
                <li><span>Runtime</span><strong>Verify public routes independently from CI and build state.</strong></li>
              </ol>
            </article>

            <article className="atlas-cloud-os-panel atlas-cloud-os-assistant">
              <p className="eyebrow">ATLAS Assistant</p>
              <h2>Context-aware operator</h2>
              <p>Use the authoritative surfaces to explain blockers, evidence and the next governed action.</p>
              <div>
                <Link to="/cloud/production-verification">Explain production evidence</Link>
                <Link to="/execution/manager/readiness">Show infrastructure evidence</Link>
              </div>
            </article>
          </section>
        </main>
      </div>
    </section>
  );
}
