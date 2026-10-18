import { Link } from 'react-router-dom';
import { WorkSubnav } from './WorkSubnav';

type WorkAppStatus = 'active' | 'gated';

type WorkApp = {
  name: string;
  area: string;
  description: string;
  to?: string;
  status: WorkAppStatus;
  boundary?: string;
};

type WorkGroup = {
  id: string;
  title: string;
  description: string;
  apps: readonly WorkApp[];
};

const WORK_GROUPS: readonly WorkGroup[] = [
  {
    id: 'productivity',
    title: 'Work & Productivity',
    description: 'Create, organize, communicate and deliver work without creating duplicate ATLAS silos.',
    apps: [
      { name: 'Docs', area: 'Documents', description: 'Draft, rewrite and structure professional documents in the governed Writing Desk.', to: '/studio/write', status: 'active' },
      { name: 'Sheets', area: 'Analysis', description: 'Analyze organization-scoped metrics and operational datasets in ATLAS Analytics.', to: '/analytics', status: 'active' },
      { name: 'Present', area: 'Presentation', description: 'Prepare delivery workflows, scripts and presentation support through the Smart Teleprompter.', to: '/studio/teleprompter', status: 'active' },
      { name: 'Mail', area: 'Communication', description: 'Enterprise messaging belongs to ATLAS Connect and approved external mail providers.', to: '/connect', status: 'gated', boundary: 'External mailbox authorization is required before ATLAS can claim message access.' },
      { name: 'Calendar', area: 'Scheduling', description: 'Calendar actions run only through verified provider connections and tenant permissions.', to: '/work/connections', status: 'gated', boundary: 'No calendar is represented as connected without a verified provider session.' },
      { name: 'Tasks', area: 'Execution', description: 'Convert intent into governed work with approvals, history and auditable execution.', to: '/work', status: 'active' },
      { name: 'Projects', area: 'Execution', description: 'Use active work, templates and team policies as the current project-execution foundation.', to: '/work/active', status: 'active' },
      { name: 'Forms', area: 'Intake', description: 'Structured intake belongs on the shared execution and data fabric instead of a parallel form silo.', status: 'gated', boundary: 'Dedicated form-builder UI is not yet implemented.' },
      { name: 'Lists', area: 'Structured data', description: 'Operational lists should resolve to canonical domain records, not detached spreadsheets.', to: '/analytics', status: 'active' },
      { name: 'Notes', area: 'Knowledge', description: 'Promote approved notes, decisions and evidence into Knowledge Atlas.', to: '/knowledge', status: 'active' },
      { name: 'Board', area: 'Collaboration', description: 'Visual planning will reuse Work tasks and approvals instead of inventing another task model.', status: 'gated', boundary: 'Dedicated collaborative board UI is not yet implemented.' },
      { name: 'Scheduling', area: 'Operations', description: 'Scheduled execution is handled by Work policies, connections and automation runtime controls.', to: '/work/policies', status: 'active' },
      { name: 'Drive', area: 'Files', description: 'Organization files require a governed storage surface with provenance, access control and audit.', status: 'gated', boundary: 'A canonical ATLAS Drive route is not yet registered.' },
      { name: 'Meetings', area: 'Communication', description: 'Meetings and calls belong to ATLAS Connect with provider-truthful readiness.', to: '/connect', status: 'gated', boundary: 'A live meeting provider must be authorized before connected state is shown.' },
      { name: 'Media', area: 'Creative', description: 'Create and manage governed visual, video, audio and voice assets in ATLAS Studio.', to: '/studio', status: 'active' },
      { name: 'Design', area: 'Creative', description: 'Use Image Lab and Creator Studio for design work with provider provenance.', to: '/studio/create?type=image', status: 'active' }
    ]
  },
  {
    id: 'intelligence',
    title: 'ATLAS Intelligence',
    description: 'One intelligence layer across the suite, using verified providers and organization-scoped context.',
    apps: [
      { name: 'ATLAS AI', area: 'Assistant', description: 'Multi-provider governed assistant with verified readiness and fail-closed execution.', to: '/assistant', status: 'active' },
      { name: 'Productivity Pro', area: 'Research & analysis', description: 'Researcher, Analyst, Writer and Executive Brief modes over the existing assistant bus.', to: '/studio/productivity-pro', status: 'active' },
      { name: 'Knowledge Atlas', area: 'Knowledge', description: 'Approved organizational memory, evidence, decisions and requirements.', to: '/knowledge', status: 'active' },
      { name: 'AI Universe', area: 'Multi-modal', description: 'Unified entry point for governed text, image, video, music and voice workflows.', to: '/studio/ai-universe', status: 'active' },
      { name: 'Voice', area: 'Conversational', description: 'Governed voice control and conversational workflows.', to: '/voice', status: 'gated', boundary: 'Provider-dependent voice actions remain readiness-gated.' },
      { name: 'Universal Search', area: 'Navigation', description: 'Search the registered ATLAS route graph from the global shell.', to: '/suite', status: 'active' }
    ]
  },
  {
    id: 'automation',
    title: 'Automation & Execution',
    description: 'The execution layer turns business intent into permission-bound actions, approvals and evidence.',
    apps: [
      { name: 'Work', area: 'Orchestration', description: 'Canonical workflow lifecycle, active queues, approvals, history and team policy.', to: '/work', status: 'active' },
      { name: 'Automations', area: 'Automation', description: 'Governed orchestration over Work, assistant intelligence and execution readiness.', to: '/automations', status: 'active' },
      { name: 'Guided Execution', area: 'Execution', description: 'Step-by-step controlled execution through the Universal Execution Engine.', to: '/execution/manager/readiness', status: 'active' },
      { name: 'Connections', area: 'Integrations', description: 'Provider connections remain explicit, revocable and organization-bound.', to: '/work/connections', status: 'active' },
      { name: 'Computer Operations', area: 'Computer use', description: 'Governed computer operation surface under Work runtime and approval boundaries.', to: '/work/computer-operations', status: 'active' },
      { name: 'Runtimes', area: 'Runtime', description: 'Inspect execution runtimes and provider availability without fabricated connected state.', to: '/work/runtimes', status: 'active' }
    ]
  },
  {
    id: 'data',
    title: 'Data & Business Intelligence',
    description: 'A shared data fabric keeps metrics, lineage and operational state connected to canonical domains.',
    apps: [
      { name: 'Business Analytics', area: 'Analytics', description: 'Cross-module analytics with source-backed metric contracts and lineage.', to: '/analytics', status: 'active' },
      { name: 'Accounting', area: 'Finance data', description: 'AP, AR, reporting and accounting operations under the canonical Finance domain.', to: '/finance/accounting', status: 'active' },
      { name: 'Inventory', area: 'Operations data', description: 'Purchasing, receiving, costing and AP matching through the canonical inventory path.', to: '/inventory/procure-to-pay', status: 'active' },
      { name: 'CRM', area: 'Customer data', description: 'Organization-scoped CRM remains provider-backed and readiness-gated.', to: '/crm', status: 'gated', boundary: 'External CRM provider readiness is required.' },
      { name: 'Commerce', area: 'Transaction data', description: 'Catalog, checkout and order operations with fail-closed providers.', to: '/commerce', status: 'gated', boundary: 'External commerce provider readiness is required for live operations.' }
    ]
  },
  {
    id: 'enterprise',
    title: 'Enterprise Operations',
    description: 'Business domains remain separate in responsibility while sharing identity, data, AI and execution foundations.',
    apps: [
      { name: 'Finance', area: 'Finance', description: 'Governed accounting and financial operations.', to: '/finance', status: 'active' },
      { name: 'Tax', area: 'Finance', description: 'Versioned tax preparation with source-document and filing boundaries.', to: '/tax', status: 'active' },
      { name: 'Payroll', area: 'People', description: 'Payroll workspace with real configuration boundaries.', to: '/payroll', status: 'gated', boundary: 'External payroll/provider capabilities remain readiness-gated.' },
      { name: 'People', area: 'People', description: 'People operations spanning workforce administration, payroll and learning.', to: '/people', status: 'active' },
      { name: 'Advisory', area: 'Business', description: 'Client, engagement and Business Launch 360 operations.', to: '/advisory', status: 'active' },
      { name: 'Revenue', area: 'Business', description: 'Canonical revenue operations across CRM, commerce and finance reconciliation.', to: '/revenue', status: 'active' },
      { name: 'Hospitality', area: 'Industry', description: 'Hospitality operations with explicit provider and data boundaries.', to: '/hospitality', status: 'gated', boundary: 'External hospitality integrations remain readiness-gated.' },
      { name: 'Ride', area: 'Mobility', description: 'Mobility and driver compliance workflows.', to: '/ride', status: 'active' },
      { name: 'Health', area: 'Health', description: 'Research and wellbeing tooling with explicit clinical boundaries.', to: '/health', status: 'active' }
    ]
  },
  {
    id: 'platform',
    title: 'Platform, Security & Governance',
    description: 'These controls sit underneath every ATLAS module rather than being optional add-ons.',
    apps: [
      { name: 'Identity', area: 'Identity', description: 'Organization access, tenant binding and session state.', to: '/identity', status: 'active' },
      { name: 'Cloud', area: 'Platform', description: 'Documentation, service discovery and governed administrative control.', to: '/cloud', status: 'active' },
      { name: 'Device OS', area: 'Device trust', description: 'Device DNA, Phoenix recovery and governed device control.', to: '/device-os', status: 'gated', boundary: 'Hardware and external device actions require verified device evidence.' },
      { name: 'Release Control', area: 'Governance', description: 'Internal release and production-readiness evidence.', to: '/release', status: 'active' },
      { name: 'Accessibility', area: 'Experience', description: 'Screen-reader, text, motion and communication accessibility controls.', to: '/settings/accessibility/communication', status: 'active' },
      { name: 'Galaxy', area: 'Navigation', description: 'Spatial module-state overview across the suite.', to: '/galaxy', status: 'active' }
    ]
  }
] as const;

const CORE_FABRIC = [
  'Identity & tenant',
  'RBAC / policy',
  'Audit & evidence',
  'ATLAS Graph',
  'Data Fabric',
  'Drive / knowledge boundary',
  'AI',
  'Automation',
  'Security'
] as const;

export function WorkOSPage() {
  const apps = WORK_GROUPS.flatMap(group => group.apps);
  const activeCount = apps.filter(app => app.status === 'active').length;
  const gatedCount = apps.filter(app => app.status === 'gated').length;

  return (
    <section className="work-page work-os-page page-stack">
      <WorkSubnav />

      <header className="page-header work-os-hero">
        <div>
          <p className="eyebrow">ATLAS Work OS</p>
          <h1>One productivity fabric. Every domain connected.</h1>
          <p>
            ATLAS Work OS unifies productivity, intelligence, automation, data and enterprise operations over the same identity,
            tenant, RBAC, audit and execution foundations. Existing modules are reused instead of duplicated.
          </p>
        </div>
        <div className="work-os-hero-actions">
          <Link className="execution-action work-primary-link" to="/studio/productivity-pro">Open Productivity Pro</Link>
          <Link className="work-os-secondary-link" to="/work/new">Create governed work</Link>
        </div>
      </header>

      <section className="work-os-runtime" aria-label="ATLAS Work OS shared runtime">
        <div>
          <p className="eyebrow">Shared runtime</p>
          <h2>Identity → Graph → Data → Knowledge → AI → Automation → Security → Apps</h2>
          <p>Every application resolves into the same control plane. No application can create a private identity silo, untracked approval path or fabricated provider connection.</p>
        </div>
        <div className="work-os-fabric" aria-label="Shared platform capabilities">
          {CORE_FABRIC.map(item => <span key={item}>{item}</span>)}
        </div>
      </section>

      <div className="work-summary-grid" aria-label="Work OS implementation summary">
        <div className="work-summary-card work-os-summary-static"><span>Mapped capabilities</span><strong>{apps.length}</strong></div>
        <div className="work-summary-card work-os-summary-static"><span>Active routes</span><strong>{activeCount}</strong></div>
        <div className="work-summary-card work-os-summary-static"><span>Truthfully gated</span><strong>{gatedCount}</strong></div>
      </div>

      {WORK_GROUPS.map(group => (
        <section className="execution-panel work-os-group" key={group.id} aria-labelledby={`work-os-${group.id}`}>
          <div className="work-section-heading">
            <div>
              <p className="eyebrow">{group.id}</p>
              <h2 id={`work-os-${group.id}`}>{group.title}</h2>
              <p>{group.description}</p>
            </div>
          </div>

          <div className="work-os-app-grid">
            {group.apps.map(app => {
              const body = (
                <>
                  <div className="work-os-card-heading">
                    <div><small>{app.area}</small><strong>{app.name}</strong></div>
                    <span className={`work-os-status ${app.status === 'active' ? 'is-active' : 'is-gated'}`}>
                      {app.status === 'active' ? 'Active route' : 'Gated'}
                    </span>
                  </div>
                  <p>{app.description}</p>
                  {app.boundary ? <small className="work-os-boundary">{app.boundary}</small> : null}
                </>
              );

              if (app.to) {
                return <Link className={`work-os-app-card ${app.status === 'active' ? 'is-active' : 'is-gated'}`} to={app.to} key={app.name}>{body}</Link>;
              }

              return <article className="work-os-app-card is-gated" aria-disabled="true" key={app.name}>{body}</article>;
            })}
          </div>
        </section>
      ))}

      <section className="execution-panel work-os-principles">
        <div>
          <p className="eyebrow">Architecture contract</p>
          <h2>Integration rules</h2>
        </div>
        <ul>
          <li>Reuse canonical modules, data models, APIs and routes before creating a new application surface.</li>
          <li>Keep provider-dependent capabilities fail-closed until authorization and server-side readiness are verified.</li>
          <li>Bind all state-changing work to organization scope, permission checks, approvals where required and audit evidence.</li>
          <li>Expose implementation status separately from production verification status.</li>
          <li>Promote cross-module work through ATLAS Work, ATLAS AI and the shared data fabric rather than point-to-point duplication.</li>
        </ul>
      </section>
    </section>
  );
}
