import { ModuleExperiencePage, type ModuleExperienceSection } from '../../components/ModuleExperiencePage';

function IntegrationHub({
  title,
  description,
  narrative,
  sections,
  statusNote
}: {
  title: string;
  description: string;
  narrative: string;
  sections: ModuleExperienceSection[];
  statusNote: string;
}) {
  return (
    <ModuleExperiencePage
      eyebrow="ATLAS Enterprise Suite · Canonical integration"
      title={title}
      description={description}
      narrative={narrative}
      sections={sections}
      statusNote={statusNote}
      actions={[{ label: 'Open A-Z directory', to: '/suite', variant: 'secondary' }]}
    />
  );
}

export function PeopleIntegrationHub() {
  return (
    <IntegrationHub
      title="ATLAS People"
      description="Canonical people operations entry point across payroll, learning and governed workforce administration."
      narrative="People • Time • Pay • Growth"
      sections={[
        {
          eyebrow: 'Operational surfaces',
          title: 'Current people capabilities',
          description: 'Open the modern ATLAS surfaces that already carry people-facing workflows.',
          cards: [
            { label: 'Pay', title: 'Payroll', description: 'Governed payroll readiness, inputs and pay-run execution.', to: '/payroll' },
            { label: 'Growth', title: 'Learning', description: 'Structured learning, practice and measurable progress.', to: '/learning' },
            { label: 'Identity', title: 'Organization access', description: 'Secure organization-scoped ATLAS identity and session verification.', to: '/identity' }
          ]
        },
        {
          eyebrow: 'Historical A-Z migration',
          title: 'Workforce administration boundary',
          description: 'Legacy employee, attendance, compensation, recruiting and self-service slices are not copied onto the modern shell until their identity/data contracts are reconciled.',
          cards: [
            { label: 'HR', title: 'Employee administration', description: 'Historical implementation identified; modern tenant/RBAC adapter required.', status: 'Migration gate' },
            { label: 'Time', title: 'Time & Attendance', description: 'Historical implementation identified; payroll/source reconciliation required.', status: 'Migration gate' },
            { label: 'Talent', title: 'Recruiting & Self-Service', description: 'Historical implementation identified; current identity contract required.', status: 'Migration gate' }
          ]
        }
      ]}
      statusNote="People is integrated as the canonical entry point. Historical workforce writes remain fail-closed until their modern tenant, permission and persistence contracts are revalidated."
    />
  );
}

export function AutomationsIntegrationHub() {
  return (
    <IntegrationHub
      title="ATLAS Automations"
      description="Governed automation orchestration over ATLAS Work, execution readiness and assistant intelligence."
      narrative="Trigger • Validate • Execute • Audit"
      sections={[
        {
          eyebrow: 'Execution',
          title: 'Working automation control planes',
          description: 'Use the current governed orchestration surfaces instead of duplicating the historical automation shell.',
          cards: [
            { label: 'Work', title: 'ATLAS Work', description: 'Sovereign work orchestration over the Universal Execution Engine.', to: '/work' },
            { label: 'Manager', title: 'Execution readiness', description: 'Readiness, approvals and governed action orchestration.', to: '/execution/manager/readiness' },
            { label: 'Intelligence', title: 'ATLAS Assistant', description: 'Reasoning and generation with verified provider readiness.', to: '/assistant' }
          ]
        },
        {
          eyebrow: 'Provider boundary',
          title: 'External triggers stay fail-closed',
          description: 'Provider-backed automations require separately verified credentials, scopes and audit evidence.',
          cards: [
            { label: 'External', title: 'Provider triggers', description: 'No external provider is represented as active without verified authorization.', status: 'External gate' }
          ]
        }
      ]}
      statusNote="Automation routing is unified on current ATLAS execution primitives. External providers and irreversible actions remain gated by their own authorization and approval policies."
    />
  );
}

export function RevenueIntegrationHub() {
  return (
    <IntegrationHub
      title="ATLAS Revenue Operations"
      description="One revenue entry point spanning customer operations, commerce, business growth and financial visibility."
      narrative="Lead • Sell • Fulfill • Reconcile"
      sections={[
        {
          eyebrow: 'Revenue stack',
          title: 'Connected commercial surfaces',
          description: 'The revenue hub composes the modern modules already responsible for customer, commerce and finance workflows.',
          cards: [
            { label: 'Customers', title: 'CRM', description: 'Organization-scoped customer and pipeline operations.', to: '/crm' },
            { label: 'Commerce', title: 'ATLAS Commerce', description: 'Catalog, checkout and governed order operations.', to: '/commerce' },
            { label: 'Growth', title: 'Business Suite', description: 'Connected growth and publishing operations.', to: '/business' },
            { label: 'Finance', title: 'Finance', description: 'Accounting and financial operations for downstream reconciliation.', to: '/finance' }
          ]
        }
      ]}
      statusNote="Revenue Operations is integrated through canonical current modules. Provider-backed CRM, payment and commerce actions still require verified external connections."
    />
  );
}

export function SiteReviewIntegrationHub() {
  return (
    <IntegrationHub
      title="ATLAS Site Review"
      description="Governed review entry point for web launch, content intelligence and execution evidence."
      narrative="Inspect • Validate • Approve • Launch"
      sections={[
        {
          eyebrow: 'Review surfaces',
          title: 'Current site review workflow',
          description: 'Use the live Creator and execution surfaces that participate in site review and launch control.',
          cards: [
            { label: 'Web', title: 'Web Launch', description: 'Prepare and govern web launch work.', to: '/studio/web-launch' },
            { label: 'Content', title: 'Content Intelligence', description: 'Review content through the Creator intelligence workspace.', to: '/studio/content' },
            { label: 'Evidence', title: 'Execution readiness', description: 'Validate readiness and governed execution state.', to: '/execution/manager/readiness' }
          ]
        }
      ]}
      statusNote="Site Review is integrated as an orchestration hub; no external scan, DNS, analytics or deployment provider is treated as verified unless its dedicated gate passes."
    />
  );
}

export function TelecomIntegrationHub() {
  return (
    <IntegrationHub
      title="ATLAS Telecom"
      description="Canonical telecom entry point spanning communications, device control and voice."
      narrative="Connect • Control • Communicate"
      sections={[
        {
          eyebrow: 'Communications stack',
          title: 'Current telecom-capable surfaces',
          description: 'ATLAS Telecom composes the modern communications and device modules already present on main.',
          cards: [
            { label: 'Communications', title: 'ATLAS Connect', description: 'Governed communications and carrier/provider connections.', to: '/connect' },
            { label: 'Devices', title: 'ATLAS Device OS', description: 'Software control plane for ATLAS device classes.', to: '/device-os' },
            { label: 'Voice', title: 'ATLAS Voice', description: 'Governed conversational voice workspace.', to: '/voice' }
          ]
        },
        {
          eyebrow: 'Carrier boundary',
          title: 'Network adapters require proof',
          description: 'SIM, MiFi, carrier provisioning and network control stay unavailable until an authorized adapter is verified.',
          cards: [
            { label: 'Carrier', title: 'MiFi / carrier control', description: 'Historical control slice identified; provider authorization and modern identity adapter required.', status: 'External gate' }
          ]
        }
      ]}
      statusNote="Telecom is integrated at the ATLAS routing layer. Carrier actions remain fail-closed until provider authorization, tenant scope and audit evidence are verified."
    />
  );
}

export function ReleaseControlIntegrationHub() {
  return (
    <IntegrationHub
      title="ATLAS Release Control"
      description="Internal release and production-readiness entry point for governed deployment evidence."
      narrative="Build • Verify • Deploy • Prove"
      sections={[
        {
          eyebrow: 'Release governance',
          title: 'Canonical verification surfaces',
          description: 'Release Control points to current readiness and system-state surfaces rather than restoring the historical controller unchanged.',
          cards: [
            { label: 'Manager', title: 'Execution readiness', description: 'Governed readiness and approval orchestration.', to: '/execution/manager/readiness' },
            { label: 'System', title: 'ATLAS Galaxy', description: 'Spatial module-state and system overview.', to: '/galaxy' },
            { label: 'Directory', title: 'A-Z module registry', description: 'Canonical module and readiness inventory.', to: '/suite' }
          ]
        }
      ]}
      statusNote="Release Control exposes no secrets and performs no deployment by itself. Production remains verified only when CI, deployment and global fail-closed route checks all pass."
    />
  );
}
