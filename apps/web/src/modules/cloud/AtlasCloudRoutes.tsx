import { useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ATLAS_MODULES } from '../registry';
import { AtlasCloudApiExplorer, AtlasCloudObservability, AtlasCloudResourceManager } from './AtlasCloudNextLevel';
import { AtlasCloudProductionVerification } from './AtlasCloudProductionVerification';
import { AtlasCloudDomains } from './AtlasCloudDomains';
import { AtlasCloudFinOps, AtlasCloudIamPolicy, AtlasCloudReliability, AtlasCloudReleaseCenter, AtlasCloudSecretsConfig, AtlasCloudServiceGraph } from './AtlasCloudOperations';
import { atlasCloudTruthBadge } from './truthStatus';

type CloudService = {
  id: string;
  name: string;
  category: string;
  route: string;
  readiness: string;
  description: string;
  requiresAuth: boolean;
};

type ServiceDomain =
  | 'Business'
  | 'Finance'
  | 'People'
  | 'Intelligence'
  | 'Platform'
  | 'Network'
  | 'Creative'
  | 'Mobility'
  | 'Health & Protection'
  | 'Operations';

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

function serviceDomain(service: CloudService): ServiceDomain {
  if (['Finance'].includes(service.category)) return 'Finance';
  if (['People'].includes(service.category)) return 'People';
  if (['Intelligence'].includes(service.category)) return 'Intelligence';
  if (['Platform'].includes(service.category)) return 'Platform';
  if (['Communications', 'Spatial'].includes(service.category)) return 'Network';
  if (['Creative', 'Entertainment'].includes(service.category)) return 'Creative';
  if (['Mobility'].includes(service.category)) return 'Mobility';
  if (['Health', 'Protection'].includes(service.category)) return 'Health & Protection';
  if (['Operations', 'Hospitality'].includes(service.category)) return 'Operations';
  return 'Business';
}

function CloudHeader({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <header className="atlas-cloud-header">
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      <p>{description}</p>
    </header>
  );
}

function ServiceCard({ service, compact }: { service: CloudService; compact: boolean }) {
  const truth = atlasCloudTruthBadge(service.readiness);
  return (
    <article className={compact ? 'atlas-cloud-service-card compact' : 'atlas-cloud-service-card'}>
      <div className="atlas-cloud-service-meta">
        <span>{service.category}</span>
        <span className={`atlas-cloud-truth-badge ${truth.state}`} title={`Source readiness: ${service.readiness}`}>
          <span aria-hidden="true">{truth.symbol}</span> {truth.label}
        </span>
      </div>
      <h3>{service.name}</h3>
      {!compact ? <p>{service.description}</p> : null}
      <div className="atlas-cloud-service-footer">
        <code>{service.route}</code>
        <span className="atlas-cloud-access-badge">{service.requiresAuth ? 'IDENTITY' : 'PUBLIC'}</span>
      </div>
      <Link to={service.route}>Open service</Link>
    </article>
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

  const groupedResults = useMemo(() => {
    const grouped = new Map<ServiceDomain, CloudService[]>();
    for (const service of results) {
      const domain = serviceDomain(service);
      grouped.set(domain, [...(grouped.get(domain) || []), service]);
    }
    return Array.from(grouped.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [results]);

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
      ) : compact ? (
        <div className="atlas-cloud-domain-list">
          {groupedResults.map(([domain, services]) => (
            <section key={domain} className="atlas-cloud-domain-group">
              <header>
                <h3>{domain}</h3>
                <span>{services.length} services</span>
              </header>
              <div className="atlas-cloud-service-grid compact">
                {services.map((service) => <ServiceCard key={service.id} service={service} compact />)}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="atlas-cloud-service-grid">
          {results.map((service) => <ServiceCard key={service.id} service={service} compact={false} />)}
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
        <Link to="/cloud">Open ATLAS Cloud Command Center</Link>
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
        ['Control plane', 'Atlas Cloud Command Center links infrastructure readiness, release control, automation and evidence surfaces.'],
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
        description="Source catalog generated from the canonical ATLAS module registry. Repository readiness is not presented as production health."
      />
      <ServiceCatalog />
    </section>
  );
}

const globalStatus = [
  { label: 'Production', state: 'VERIFY', to: '/cloud/production-verification' },
  { label: 'Security', state: 'EVIDENCE', to: '/cloud/iam' },
  { label: 'Release', state: 'CONTROL', to: '/cloud/releases' },
  { label: 'Providers', state: 'READINESS', to: '/execution/manager/readiness' },
  { label: 'Incidents', state: 'OBSERVE', to: '/cloud/incidents' },
  { label: 'Cost', state: 'FINOPS', to: '/cloud/finops' }
] as const;

const commandCenter = [
  { area: 'Developer', title: 'API Explorer', description: 'Inspect the governed OpenAPI contract and approved read operations.', to: '/cloud/api-explorer' },
  { area: 'Operations', title: 'Observability', description: 'Inspect incidents, traces, metrics and runtime verification evidence.', to: '/cloud/observability' },
  { area: 'Resources', title: 'Resource Manager', description: 'Manage organization projects and inspect the canonical service registry.', to: '/cloud/resources' },
  { area: 'Network', title: 'Domains & DNS', description: 'Verify public DNS evidence with provider mutations remaining fail-closed.', to: '/cloud/domains' },
  { area: 'Topology', title: 'Service Graph', description: 'Visualize canonical backend authority and registry state.', to: '/cloud/service-graph' },
  { area: 'Governance', title: 'IAM & Policy', description: 'Inspect tenant scope, role boundaries and inherited policy surfaces.', to: '/cloud/iam' },
  { area: 'Configuration', title: 'Secrets & Config', description: 'Inspect secret boundaries and runtime readiness without exposing values.', to: '/cloud/config' },
  { area: 'Automation', title: 'ATLAS Automations', description: 'Run governed workflows through existing execution boundaries.', to: '/automations' }
] as const;

const authorities = [
  ['GitHub', 'Canonical source, change history, CI and release coordination'],
  ['Supabase', 'Primary database, identity, storage and backend control plane'],
  ['Cloudflare', 'Primary web edge and production verification boundary'],
  ['ATLAS Manager', 'Infrastructure readiness and deployment orchestration authority']
] as const;

function ConsoleHome() {
  return (
    <section className="atlas-cloud-page atlas-cloud-console">
      <CloudHeader
        eyebrow="ATLAS Cloud Command Center"
        title="One sovereign control plane for infrastructure, releases, services and production truth"
        description="ATLAS reuses canonical control planes and fails closed when provider, release or production evidence is unavailable."
      />

      <section className="atlas-cloud-global-status" aria-label="Global status">
        <div className="atlas-cloud-status-heading">
          <div><p className="eyebrow">Global status</p><strong>No green state without evidence</strong></div>
          <Link to="/cloud/production-verification">Verify production</Link>
        </div>
        <div className="atlas-cloud-status-strip">
          {globalStatus.map((item) => (
            <Link key={item.label} to={item.to}>
              <span>{item.label}</span>
              <strong>{item.state}</strong>
            </Link>
          ))}
        </div>
      </section>

      <section className="atlas-cloud-release-operations" aria-label="Release and operations">
        <div>
          <p className="eyebrow">Release & Operations</p>
          <h2>One release truth, multiple evidence views</h2>
          <p>Readiness, deployment, production verification and rollback remain separate facts backed by their canonical surfaces.</p>
        </div>
        <nav aria-label="Release and operations shortcuts">
          <Link to="/execution/manager/readiness">Readiness</Link>
          <Link to="/cloud/releases">Deployments</Link>
          <Link to="/cloud/production-verification">Production</Link>
          <Link to="/release">Evidence & rollback</Link>
        </nav>
      </section>

      <div className="atlas-cloud-section-heading">
        <div><p className="eyebrow">Critical operations</p><h2>Command Center</h2></div>
        <Link to="/cloud/docs/operations">Operations guide</Link>
      </div>

      <div className="atlas-cloud-console-grid">
        {commandCenter.map((item) => (
          <Link key={item.title} to={item.to}>
            <span>{item.area}</span>
            <strong>{item.title}</strong>
            <p>{item.description}</p>
          </Link>
        ))}
      </div>

      <section className="atlas-cloud-topology" aria-label="Atlas Cloud configured authorities">
        <div className="atlas-cloud-section-heading">
          <div><p className="eyebrow">Control plane</p><h2>Configured authorities</h2></div>
          <Link to="/execution/manager/readiness">Open readiness evidence</Link>
        </div>
        <div className="atlas-cloud-topology-grid">
          {authorities.map(([name, description]) => (
            <article key={name}>
              <div className="atlas-cloud-authority-heading">
                <strong>{name}</strong>
                <span className="atlas-cloud-evidence-badge">EVIDENCE REQUIRED</span>
              </div>
              <span>{description}</span>
            </article>
          ))}
        </div>
        <p className="atlas-cloud-truth-note">Configuration identifies authority only. Connectivity and health must be proven by current readiness, release and runtime evidence.</p>
      </section>

      <div className="atlas-cloud-section-heading">
        <div><p className="eyebrow">Service inventory</p><h2>Registered services by domain</h2></div>
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
