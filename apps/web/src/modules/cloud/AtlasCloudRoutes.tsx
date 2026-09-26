import { useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ATLAS_MODULES } from '../registry';
import { AtlasCloudApiExplorer, AtlasCloudObservability, AtlasCloudResourceManager } from './AtlasCloudNextLevel';
import { AtlasCloudProductionVerification } from './AtlasCloudProductionVerification';
import { AtlasCloudDomains } from './AtlasCloudDomains';
import { AtlasCloudFinOps, AtlasCloudIamPolicy, AtlasCloudReliability, AtlasCloudReleaseCenter, AtlasCloudSecretsConfig, AtlasCloudServiceGraph } from './AtlasCloudOperations';

type CloudService = {
  id: string;
  name: string;
  category: string;
  route: string;
  readiness: string;
  description: string;
  requiresAuth: boolean;
};

const cloudServices: CloudService[] = ATLAS_MODULES
  .filter((module) => module.id !== 'cloud')
  .map((module) => ({
    id: module.id,
    name: module.title,
    category: module.area,
    route: module.route,
    readiness: module.readiness,
    description: module.description,
    requiresAuth: module.requiresAuth
  }));

const categories = Array.from(new Set(cloudServices.map((service) => service.category))).sort();

function CloudHeader({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <header className="atlas-cloud-header">
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      <p>{description}</p>
    </header>
  );
}

function ServiceCatalog({ compact = false }: { compact?: boolean }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const results = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return cloudServices.filter((service) => {
      const matchesCategory = category === 'All' || service.category === category;
      const matchesQuery = !normalized
        || service.name.toLowerCase().includes(normalized)
        || service.description.toLowerCase().includes(normalized)
        || service.route.toLowerCase().includes(normalized);
      return matchesCategory && matchesQuery;
    });
  }, [query, category]);

  return (
    <section className="atlas-cloud-catalog" aria-label="ATLAS Cloud service catalog">
      <div className="atlas-cloud-toolbar">
        <label>
          <span>Search services</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search Finance, Work, Health, routes..."
          />
        </label>
        <label>
          <span>Category</span>
          <select value={category} onChange={(event) => setCategory(event.target.value)}>
            <option>All</option>
            {categories.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
      </div>

      {results.length === 0 ? (
        <div className="atlas-cloud-empty" role="status">
          <strong>No services match this search.</strong>
          <span>Clear the filters or use another ATLAS module name.</span>
        </div>
      ) : (
        <div className={compact ? 'atlas-cloud-service-grid compact' : 'atlas-cloud-service-grid'}>
          {results.map((service) => (
            <article key={service.id} className="atlas-cloud-service-card">
              <div className="atlas-cloud-service-meta">
                <span>{service.category}</span>
                <span>{service.readiness}</span>
              </div>
              <h3>{service.name}</h3>
              <p>{service.description}</p>
              <div className="atlas-cloud-service-footer">
                <code>{service.route}</code>
                <span>{service.requiresAuth ? 'Identity required' : 'Public entry available'}</span>
              </div>
              <Link to={service.route}>Open service</Link>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function DocumentationHome() {
  return (
    <section className="atlas-cloud-page atlas-cloud-docs">
      <CloudHeader
        eyebrow="ATLAS Cloud Documentation"
        title="Build, operate and verify the ATLAS ecosystem"
        description="Discover ATLAS services, architecture, execution controls and governed production boundaries from one documentation surface."
      />

      <div className="atlas-cloud-hero-actions">
        <Link className="atlas-cloud-primary" to="/cloud/docs/catalog">Browse service catalog</Link>
        <Link to="/cloud">Open Atlas Cloud Console</Link>
      </div>

      <div className="atlas-cloud-feature-grid">
        <article>
          <span>01</span>
          <h2>Get started</h2>
          <p>Understand the canonical repository, identity model, tenant boundaries and the GitHub → Supabase → Cloudflare production path.</p>
          <Link to="/cloud/docs/get-started">Start here</Link>
        </article>
        <article>
          <span>02</span>
          <h2>Service catalog</h2>
          <p>Search the actual ATLAS module registry rather than a duplicated marketing list.</p>
          <Link to="/cloud/docs/catalog">Explore services</Link>
        </article>
        <article>
          <span>03</span>
          <h2>Architecture</h2>
          <p>Follow the control-plane, execution, release, RBAC, audit and provider-evidence boundaries used across ATLAS.</p>
          <Link to="/cloud/docs/architecture">View architecture</Link>
        </article>
        <article>
          <span>04</span>
          <h2>Operations</h2>
          <p>Use production readiness, release control and governed automations without presenting provider state that has not been verified.</p>
          <Link to="/cloud/docs/operations">Open operations guide</Link>
        </article>
      </div>

      <div className="atlas-cloud-section-heading">
        <div><p className="eyebrow">Discover</p><h2>ATLAS services</h2></div>
        <Link to="/cloud/docs/catalog">See all</Link>
      </div>
      <ServiceCatalog compact />
    </section>
  );
}

function DocumentationArticle({ kind }: { kind: 'get-started' | 'architecture' | 'operations' }) {
  const content = {
    'get-started': {
      title: 'Get started with Atlas Cloud',
      description: 'Start from the existing ATLAS control plane instead of creating another infrastructure island.',
      points: [
        ['Canonical source', 'GitHub is the source of truth for code, history, CI and release coordination.'],
        ['Backend authority', 'Supabase provides the primary database, authentication, storage and backend control-plane direction.'],
        ['Public edge', 'Cloudflare is the primary public web and production verification boundary.'],
        ['Identity first', 'Administrative operations stay behind ATLAS Identity, organization scope, RBAC and audit controls.']
      ]
    },
    architecture: {
      title: 'Atlas Cloud architecture',
      description: 'A connected control plane over the ATLAS ecosystem, not a separate replacement platform.',
      points: [
        ['Documentation plane', 'Public documentation and catalog routes expose original ATLAS guidance and real registry metadata.'],
        ['Control plane', 'Atlas Cloud Console links infrastructure readiness, release control, automation and evidence surfaces.'],
        ['Data plane', 'Existing ATLAS modules continue using their established Supabase tables, APIs and provider adapters.'],
        ['Verification plane', 'Production truth remains separate from build success and requires provider plus public-route evidence.']
      ]
    },
    operations: {
      title: 'Operate Atlas Cloud',
      description: 'Use governed entry points for readiness, releases and automations.',
      points: [
        ['Readiness', 'Inspect provider requirements and blockers through the existing ATLAS Manager readiness workflow.'],
        ['Release', 'Use Release Control to keep source, deployment and verification states distinct.'],
        ['Automations', 'Run governed workflows without inventing connected-provider state.'],
        ['Fail closed', 'Critical public-domain and ATLAS Network route verification must remain a release gate when configured.']
      ]
    }
  }[kind];

  return (
    <section className="atlas-cloud-page atlas-cloud-article">
      <Link className="atlas-cloud-back" to="/cloud/docs">← Documentation</Link>
      <CloudHeader eyebrow="ATLAS Cloud Documentation" title={content.title} description={content.description} />
      <div className="atlas-cloud-article-grid">
        {content.points.map(([title, body]) => (
          <article key={title}><h2>{title}</h2><p>{body}</p></article>
        ))}
      </div>
    </section>
  );
}

function CatalogPage() {
  return (
    <section className="atlas-cloud-page">
      <Link className="atlas-cloud-back" to="/cloud/docs">← Documentation</Link>
      <CloudHeader
        eyebrow="ATLAS Cloud"
        title="Service catalog"
        description="Live source catalog generated from the canonical ATLAS module registry. Readiness labels describe repository state, not unverified provider connectivity."
      />
      <ServiceCatalog />
    </section>
  );
}

function ConsoleHome() {
  return (
    <section className="atlas-cloud-page atlas-cloud-console">
      <CloudHeader
        eyebrow="ATLAS Cloud Console"
        title="Operate Atlas from one control surface"
        description="The console reuses existing ATLAS control planes. It does not duplicate secrets, provider state, release truth or infrastructure ownership."
      />

      <div className="atlas-cloud-console-grid">
        <Link to="/cloud/api-explorer">
          <span>Developer</span><strong>API Explorer</strong>
          <p>Inspect the live OpenAPI contract and run approved read-only cloud operations.</p>
        </Link>
        <Link to="/cloud/observability">
          <span>Operations</span><strong>Observability</strong>
          <p>View native incidents, traces, metrics and runtime verification evidence.</p>
        </Link>
        <Link to="/cloud/resources">
          <span>Resources</span><strong>Resource Manager</strong>
          <p>Manage organization projects and inspect the canonical ATLAS service registry.</p>
        </Link>
        <Link to="/cloud/domains">
          <span>Network</span><strong>Domains & DNS</strong>
          <p>Verify public DNS evidence while provider mutations remain fail-closed.</p>
        </Link>
        <Link to="/cloud/service-graph">
          <span>Topology</span><strong>Service Graph</strong>
          <p>Visualize services by canonical backend authority and verified registry state.</p>
        </Link>
        <Link to="/cloud/production-verification">
          <span>Integrity</span><strong>Production Verification</strong>
          <p>Verify security, build, deployment, runtime and exact-SHA evidence without fabricating green state.</p>
        </Link>
        <Link to="/cloud/releases">
          <span>Delivery</span><strong>Deployment & Release Center</strong>
          <p>Separate source, deployment and production verification using Release Control truth.</p>
        </Link>
        <Link to="/cloud/iam">
          <span>Governance</span><strong>IAM & Policy</strong>
          <p>Inspect tenant scope, role boundaries and inherited policy surfaces.</p>
        </Link>
        <Link to="/cloud/config">
          <span>Configuration</span><strong>Secrets & Config</strong>
          <p>Inspect secret boundaries and runtime readiness without exposing secret values.</p>
        </Link>
        <Link to="/cloud/finops">
          <span>Cost</span><strong>FinOps</strong>
          <p>Govern billing integration, budgets and cost evidence with fail-closed totals.</p>
        </Link>
        <Link to="/cloud/incidents">
          <span>Reliability</span><strong>Incident Center</strong>
          <p>Read canonical incidents and correlate operational state with releases and telemetry.</p>
        </Link>
        <Link to="/execution/manager/readiness">
          <span>Infrastructure</span><strong>Manager Readiness</strong>
          <p>Evaluate provider requirements and real blockers before any deployment claim.</p>
        </Link>
        <Link to="/release">
          <span>Release</span><strong>Release Control</strong>
          <p>Inspect governed release state, gates, evidence and production verification.</p>
        </Link>
        <Link to="/automations">
          <span>Automation</span><strong>ATLAS Automations</strong>
          <p>Run governed workflows through existing ATLAS execution boundaries.</p>
        </Link>
        <Link to="/knowledge">
          <span>Knowledge</span><strong>Knowledge Atlas</strong>
          <p>Use approved organizational decisions, requirements and evidence as operational context.</p>
        </Link>
      </div>

      <section className="atlas-cloud-topology" aria-label="Atlas Cloud configured authorities">
        <div className="atlas-cloud-section-heading"><div><p className="eyebrow">Control plane</p><h2>Configured authorities</h2></div></div>
        <div className="atlas-cloud-topology-grid">
          <article><strong>GitHub</strong><span>Canonical source, change history, CI and release coordination</span></article>
          <article><strong>Supabase</strong><span>Primary database, identity, storage and backend control plane</span></article>
          <article><strong>Cloudflare</strong><span>Primary web edge and production verification boundary</span></article>
          <article><strong>ATLAS Manager</strong><span>Infrastructure readiness and deployment orchestration authority</span></article>
        </div>
        <p className="atlas-cloud-truth-note">Provider connectivity must be proven by the existing readiness and release evidence surfaces. This page does not infer a live connection from configuration alone.</p>
      </section>

      <div className="atlas-cloud-section-heading">
        <div><p className="eyebrow">Inventory</p><h2>Registered services</h2></div>
        <Link to="/cloud/docs/catalog">Open documentation catalog</Link>
      </div>
      <ServiceCatalog compact />
    </section>
  );
}

export function AtlasCloudRoutes() {
  const { pathname } = useLocation();

  if (pathname === '/cloud/docs' || pathname === '/cloud/docs/') return <DocumentationHome />;
  if (pathname === '/cloud/docs/catalog') return <CatalogPage />;
  if (pathname === '/cloud/docs/get-started') return <DocumentationArticle kind="get-started" />;
  if (pathname === '/cloud/docs/architecture') return <DocumentationArticle kind="architecture" />;
  if (pathname === '/cloud/docs/operations') return <DocumentationArticle kind="operations" />;
  if (pathname === '/cloud/api-explorer') return <AtlasCloudApiExplorer />;
  if (pathname === '/cloud/observability') return <AtlasCloudObservability />;
  if (pathname === '/cloud/resources') return <AtlasCloudResourceManager />;
  if (pathname === '/cloud/domains') return <AtlasCloudDomains />;
  if (pathname === '/cloud/service-graph') return <AtlasCloudServiceGraph />;
  if (pathname === '/cloud/releases') return <AtlasCloudReleaseCenter />;
  if (pathname === '/cloud/production-verification') return <AtlasCloudProductionVerification />;
  if (pathname === '/cloud/iam') return <AtlasCloudIamPolicy />;
  if (pathname === '/cloud/config') return <AtlasCloudSecretsConfig />;
  if (pathname === '/cloud/finops') return <AtlasCloudFinOps />;
  if (pathname === '/cloud/incidents') return <AtlasCloudReliability />;
  return <ConsoleHome />;
}
