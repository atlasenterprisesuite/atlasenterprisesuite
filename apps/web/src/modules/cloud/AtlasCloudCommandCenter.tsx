import { Link } from 'react-router-dom';
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
  ['Documentation', '/cloud/docs'],
] as const;

const createActions = [
  ['Deploy application', '/cloud/releases'],
  ['Create project', '/cloud/resources'],
  ['Create database', '/cloud/resources'],
  ['Add domain', '/cloud/domains'],
  ['Create API', '/cloud/api-explorer'],
  ['Create automation', '/automations'],
] as const;

const providers = [
  { name: 'GitHub', role: 'Canonical source + CI', required: true },
  { name: 'Supabase', role: 'Database + Auth + backend control plane', required: true },
  { name: 'Cloudflare', role: 'Public edge + DNS + runtime verification', required: true },
  { name: 'Vercel', role: 'Optional deployment adapter', required: false },
  { name: 'AWS / Azure / GCP', role: 'Future interchangeable adapters', required: false },
  { name: 'Self-hosted', role: 'Future sovereign runtime adapter', required: false },
] as const;

const healthSurfaces = [
  { label: 'Source', state: 'in_progress', route: '/release', note: 'Release evidence decides exact source truth.' },
  { label: 'Backend', state: 'in_progress', route: '/execution/manager/readiness', note: 'Supabase readiness is verified outside this dashboard.' },
  { label: 'Edge', state: 'in_progress', route: '/cloud/domains', note: 'DNS, TLS and edge evidence are checked separately.' },
  { label: 'Security', state: 'warning', route: '/cloud/incidents', note: 'Warnings remain visible until remediated or explicitly accepted.' },
  { label: 'Production', state: 'in_progress', route: '/cloud/production-verification', note: 'Only public verification can mark production verified.' },
] as const;

function TruthChip({ state }: { state: string }) {
  const truth = atlasCloudTruthBadge(state);
  return (
    <span className={`atlas-cloud-truth-badge ${truth.state}`}>
      <span aria-hidden="true">{truth.symbol}</span> {truth.label}
    </span>
  );
}

export function AtlasCloudCommandCenter() {
  const modules = ATLAS_MODULES.filter((module) => module.id !== 'cloud').slice(0, 12);

  return (
    <section className="atlas-cloud-os-shell" aria-label="ATLAS Cloud Command Center">
      <header className="atlas-cloud-os-topbar">
        <div className="atlas-cloud-os-brand">
          <span className="atlas-cloud-os-mark">A</span>
          <div><strong>ATLAS CLOUD</strong><small>Control Center</small></div>
        </div>
        <div className="atlas-cloud-os-context">
          <button type="button" aria-label="Current organization">ATLAS Enterprise Suite</button>
          <button type="button" aria-label="Current environment">Production</button>
        </div>
        <label className="atlas-cloud-os-search">
          <span className="sr-only">Search ATLAS Cloud</span>
          <input type="search" placeholder="Search resources, modules, releases, commands…" />
        </label>
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
              <p>Deploy, inspect, verify and recover the ecosystem while provider-specific complexity stays behind governed ATLAS adapters.</p>
            </div>
            <div className="atlas-cloud-os-hero-actions">
              <Link className="atlas-cloud-primary" to="/cloud/production-verification">Production Verification</Link>
              <Link to="/cloud/service-graph">Open Service Graph</Link>
            </div>
          </section>

          <section className="atlas-cloud-os-health" aria-labelledby="atlas-cloud-health-title">
            <div className="atlas-cloud-os-section-heading">
              <div><p className="eyebrow">System Health</p><h2 id="atlas-cloud-health-title">Evidence surfaces</h2></div>
              <Link to="/cloud/production-verification">View exact evidence</Link>
            </div>
            <div className="atlas-cloud-os-health-grid">
              {healthSurfaces.map((item) => (
                <Link key={item.label} to={item.route} className="atlas-cloud-os-health-card">
                  <span>{item.label}</span>
                  <TruthChip state={item.state} />
                  <small>{item.note}</small>
                </Link>
              ))}
            </div>
          </section>

          <section className="atlas-cloud-os-grid">
            <article className="atlas-cloud-os-panel atlas-cloud-os-architecture">
              <div className="atlas-cloud-os-section-heading">
                <div><p className="eyebrow">Architecture</p><h2>Live control path</h2></div>
                <Link to="/cloud/service-graph">Expand</Link>
              </div>
              <div className="atlas-cloud-os-control-node">
                <span>ATLAS CLOUD</span><strong>CONTROL PLANE</strong>
              </div>
              <div className="atlas-cloud-os-flow">
                <Link to="/release"><span>GitHub</span><small>Source + CI</small></Link>
                <Link to="/execution/manager/readiness"><span>Supabase</span><small>Backend authority</small></Link>
                <Link to="/cloud/domains"><span>Cloudflare</span><small>Public edge</small></Link>
              </div>
              <div className="atlas-cloud-os-flow-arrow" aria-hidden="true">↓</div>
              <Link className="atlas-cloud-os-production-node" to="/cloud/production-verification">
                <span>Production</span>
                <small>Public runtime verification required</small>
              </Link>
            </article>

            <article className="atlas-cloud-os-panel">
              <div className="atlas-cloud-os-section-heading">
                <div><p className="eyebrow">Command Center</p><h2>Create & operate</h2></div>
              </div>
              <div className="atlas-cloud-os-command-grid">
                {createActions.map(([label, route]) => <Link key={label} to={route}>+ {label}</Link>)}
              </div>
              <p className="atlas-cloud-os-muted">Actions route through existing ATLAS permission, approval, audit and provider boundaries.</p>
            </article>
          </section>

          <section className="atlas-cloud-os-grid">
            <article className="atlas-cloud-os-panel">
              <div className="atlas-cloud-os-section-heading">
                <div><p className="eyebrow">Resource Explorer</p><h2>Organization hierarchy</h2></div>
                <Link to="/cloud/resources">Open manager</Link>
              </div>
              <div className="atlas-cloud-os-tree">
                <strong>ATLAS Enterprise Suite</strong>
                <div><span>Production</span><small>Applications · Databases · APIs · Storage · Domains · Automations</small></div>
                <div><span>Staging</span><small>Pre-production verification boundary</small></div>
                <div><span>Development</span><small>Isolated implementation workspace</small></div>
              </div>
            </article>

            <article className="atlas-cloud-os-panel">
              <div className="atlas-cloud-os-section-heading">
                <div><p className="eyebrow">Providers</p><h2>Adapter registry</h2></div>
              </div>
              <div className="atlas-cloud-os-provider-list">
                {providers.map((provider) => (
                  <div key={provider.name}>
                    <span><strong>{provider.name}</strong><small>{provider.role}</small></span>
                    <b>{provider.required ? 'REQUIRED PATH' : 'OPTIONAL'}</b>
                  </div>
                ))}
              </div>
              <p className="atlas-cloud-os-muted">Provider role does not imply a live connection. Connectivity is proven only by evidence surfaces.</p>
            </article>
          </section>

          <section className="atlas-cloud-os-panel">
            <div className="atlas-cloud-os-section-heading">
              <div><p className="eyebrow">ATLAS Galaxy</p><h2>Connected product systems</h2></div>
              <Link to="/cloud/docs/catalog">Full catalog</Link>
            </div>
            <div className="atlas-cloud-os-galaxy">
              {modules.map((module) => {
                const truth = atlasCloudTruthBadge(module.readiness);
                return (
                  <Link key={module.id} to={module.route} className={`atlas-cloud-os-orbit ${truth.state}`}>
                    <span>{module.title}</span>
                    <small>{truth.label}</small>
                  </Link>
                );
              })}
            </div>
          </section>

          <section className="atlas-cloud-os-grid atlas-cloud-os-bottom">
            <article className="atlas-cloud-os-panel">
              <div className="atlas-cloud-os-section-heading">
                <div><p className="eyebrow">Recent Activity</p><h2>Operational timeline</h2></div>
                <Link to="/cloud/observability">Observability</Link>
              </div>
              <ol className="atlas-cloud-os-timeline">
                <li><span>Release</span><strong>Review canonical release and deployment evidence</strong></li>
                <li><span>Security</span><strong>Surface active warnings without converting them to green</strong></li>
                <li><span>Runtime</span><strong>Verify public routes independently from CI/build state</strong></li>
              </ol>
            </article>

            <article className="atlas-cloud-os-panel atlas-cloud-os-assistant">
              <p className="eyebrow">ATLAS Assistant</p>
              <h2>Context-aware operator</h2>
              <p>Uses the current Cloud surface to explain blockers, evidence and the next governed action.</p>
              <div>
                <Link to="/cloud/production-verification">Explain production blockers</Link>
                <Link to="/execution/manager/readiness">Show infrastructure evidence</Link>
              </div>
            </article>
          </section>
        </main>
      </div>
    </section>
  );
}
