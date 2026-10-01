import { ModuleExperiencePage, type ModuleExperienceSection } from '../../components/ModuleExperiencePage';
import { FinanceControlCenterPanel } from '../finance/FinanceControlCenterPanel';

const enterpriseSections: ModuleExperienceSection[] = [
  {
    eyebrow: 'Architecture',
    title: 'One suite, many governed operating systems',
    description: 'ATLAS keeps enterprise functions inside one organization context, one navigation model and one governed execution boundary.',
    cards: [
      { label: 'Business', title: 'Business Suite', description: 'Growth operations and governed publishing workflows.', to: '/business' },
      { label: 'Finance', title: 'Finance', description: 'Accounting and financial operations with live routes for current implemented capabilities.', to: '/finance' },
      { label: 'Customer', title: 'CRM', description: 'Provider-backed customer, company, opportunity and service workflows.', to: '/crm' },
      { label: 'People', title: 'Payroll', description: 'Governed payroll workspace using the authenticated ATLAS organization.', to: '/payroll' },
      { label: 'Learning', title: 'Learning', description: 'Structured practice and neuroplasticity programs with visible safety boundaries.', to: '/learning' },
      { label: 'Health', title: 'ATLAS Health', description: 'Governed research and wellbeing tooling with explicit evidence boundaries.', to: '/health' },
      { label: 'Creative', title: 'Creator Studio', description: 'Image, video, voice and content intelligence workspaces.', to: '/studio' },
      { label: 'Execution', title: 'Guided Execution', description: 'Launch governed workflows through the shared execution engine.', to: '/execution/manager/readiness' }
    ]
  },
  {
    eyebrow: 'Vertical systems',
    title: 'Connected operational domains',
    description: 'Vertical products remain part of the same ATLAS identity and organization instead of becoming isolated applications.',
    cards: [
      { label: 'Hospitality', title: 'Hospitality', description: 'Hotel and hospitality access, operations and governed integration surfaces.', to: '/hospitality/access' },
      { label: 'Mobility', title: 'Ride', description: 'Driver, compliance and mobility operations with truthful provider boundaries.', to: '/ride' },
      { label: 'Entertainment', title: 'ATLAS FRONTIER', description: 'Explore, extract, craft, build and restore the Sky Grid through a governed server-authoritative vertical slice.', to: '/frontier' },
      { label: 'People', title: 'HR & Time', description: 'Commercial HR, time and recruiting depth is still being reconciled into the canonical suite.', status: 'Canonical module depth in progress' },
      { label: 'Commerce', title: 'Inventory & Purchasing', description: 'Canonical PO receiving, packing-slip evidence, three-way invoice matching, inventory costing and margin pricing.', to: '/inventory/procure-to-pay', status: 'Canonical procure-to-pay active' },
      { label: 'Operations', title: 'POS & Projects', description: 'Shared execution concepts exist; complete commercial module surfaces are not yet represented as active routes.', status: 'Canonical module depth in progress' },
      { label: 'Intelligence', title: 'Analytics', description: 'Reporting exists across modules, while the universal analytics hub remains a gated commercial capability.', status: 'Universal hub not yet active' }
    ]
  },
  {
    eyebrow: 'Sovereign trust',
    title: 'Execution must remain verifiable',
    description: 'ATLAS presents readiness truthfully: implemented routes are navigable, external dependencies remain explicit and unavailable capabilities are never disguised as live.',
    cards: [
      { label: 'Identity', title: 'Organization context', description: 'The shared shell carries authenticated organization and role context across modules.' },
      { label: 'Governance', title: 'RBAC & audit', description: 'Sensitive operations remain subject to existing permission and audit boundaries.' },
      { label: 'Evidence', title: 'No fabricated state', description: 'Metrics, provider connectivity and operational claims must come from authorized sources.' }
    ]
  }
];

const businessSections: ModuleExperienceSection[] = [
  {
    eyebrow: 'Growth architecture',
    title: 'Growth operations, customer workflows and governed publishing',
    description: 'Business Suite connects the implemented growth and customer surfaces without presenting external channel connectivity as active before authorization.',
    cards: [
      { label: 'Growth', title: 'Social Publisher', description: 'Prepare multi-platform publishing assets and preserve provider authorization gates.', to: '/business/growth/social-publisher' },
      { label: 'Customer', title: 'CRM', description: 'Open provider-backed customer, company, opportunity and service workflows.', to: '/crm' },
      { label: 'Creative', title: 'Creator Studio', description: 'Create and prepare governed content for downstream business workflows.', to: '/studio' }
    ]
  },
  {
    eyebrow: 'Channel governance',
    title: 'External connections remain explicit',
    description: 'ATLAS does not label a publishing channel connected unless the organization has authorized it and the provider state is verified.',
    cards: [
      { label: 'Connections', title: 'Channel connections', description: 'Social account authorization is required before direct publication can become available.', status: 'Authorization required' },
      { label: 'Publishing', title: 'Direct publishing', description: 'Execution remains disabled when provider credentials or organization authorization are missing.', status: 'Connection gate enforced' },
      { label: 'Audit', title: 'Governed handoff', description: 'Prepared content can move between ATLAS creative and publishing surfaces without bypassing connection gates.' }
    ]
  },
  {
    eyebrow: 'Commercial expansion',
    title: 'Canonical business depth with explicit gates',
    description: 'Revenue, commerce and analytics now have canonical entry points. Provider-backed execution, downstream adapters and universal aggregation remain unavailable until their own contracts and authorization evidence pass.',
    cards: [
      { label: 'Sales', title: 'Revenue Operations', description: 'Canonical revenue operations compose CRM, commerce, growth and finance without duplicating their sources of truth.', to: '/revenue', status: 'Canonical hub active' },
      { label: 'Commerce', title: 'Commerce Core', description: 'Catalog, products, orders and payment settings are available through ATLAS Commerce; POS and inventory adapters remain gated until separately verified.', to: '/commerce', status: 'Canonical core active · adapters gated' },
      { label: 'Analytics', title: 'Business Analytics', description: 'A canonical analytics hub now composes existing source-backed reporting surfaces; universal KPI aggregation remains source-gated.', to: '/analytics', status: 'Canonical hub active · aggregation gated' }
    ]
  }
];

const financeSections: ModuleExperienceSection[] = [
  {
    eyebrow: 'Enterprise advisory',
    title: 'Measure the operating cycle',
    description: 'Explore the cross-module process and estimate recoverable capacity with transparent, editable assumptions.',
    cards: [
      { label: 'Scenario', title: 'Enterprise Automation', description: 'Model AP, AR, reconciliation, close, people, stock, purchasing and administration across legal entities. Projections are not production measurements.', to: '/advisory/enterprise-automation' }
    ]
  },
  {
    eyebrow: 'Financial architecture',
    title: 'Accounting is the operational core',
    description: 'Current finance routes expose implemented accounting workflows while broader commercial domains stay gated until their canonical contracts exist.',
    cards: [
      { label: 'Accounting', title: 'Accounting', description: 'Open the governed Accounting module landing surface.', to: '/finance/accounting' },
      { label: 'Payables', title: 'Accounts Payable', description: 'Vendor bills, aging, balances, approvals and payment application state.', to: '/finance/accounting/accounts-payable' },
      { label: 'Inventory', title: 'Procure to Pay', description: 'PO receiving, packing-slip matching, AP registration and inventory cost/margin controls.', to: '/inventory/procure-to-pay' },
      { label: 'Reporting', title: 'Automotive Sales', description: 'Vehicle, F&I, fixed operations, inventory and floorplan financial reporting.', to: '/finance/accounting/reports/automotive-sales' }
    ]
  },
  {
    eyebrow: 'Planning & control',
    title: 'Finance depth from the canonical accounting backend',
    description: 'ATLAS surfaces the real organization-scoped state that already exists for budgeting, currency, close and consolidation without fabricating provider readiness.',
    cards: [
      { label: 'Receivables', title: 'Accounts Receivable', description: 'Live customer invoicing with governed inventory issue, COGS and gross-margin posting for inventory-backed products.', to: '/finance/accounting/accounts-receivable', status: 'Canonical AR active' },
      { label: 'Planning', title: 'Budgeting', description: 'Budget versions, lifecycle and approval state are read from the RLS-protected accounting backend.', status: 'Live backend state surfaced below' },
      { label: 'Currency', title: 'Multi-currency', description: 'Registered FX rates and evidence state remain organization-scoped and source-backed.', status: 'Live backend state surfaced below' },
      { label: 'Group reporting', title: 'Consolidation', description: 'Consolidation groups and intercompany controls remain governed by accounting permissions.', status: 'Live backend state surfaced below' },
      { label: 'Close', title: 'Period Close', description: 'Accounting periods and close readiness are read from the canonical close controls.', status: 'Live backend state surfaced below' },
      { label: 'Cash', title: 'Bank & Reconciliation', description: 'ATLAS exposes only registered bank and reconciliation state; external banking execution stays gated until authorization is verified.', status: 'Provider execution remains fail-closed' }
    ]
  },
  {
    eyebrow: 'Control',
    title: 'Financial truth is a product requirement',
    description: 'ATLAS Finance keeps source state, approvals and organization boundaries visible instead of presenting invented totals or connectivity.',
    cards: [
      { label: 'Tenant', title: 'Organization scoped', description: 'Finance remains inside the authenticated ATLAS organization boundary.' },
      { label: 'Approvals', title: 'Governed execution', description: 'Sensitive financial actions must respect existing permission and approval controls.' },
      { label: 'Evidence', title: 'Source-backed reporting', description: 'Operational values are shown only when a real configured source provides them.' }
    ]
  }
];

const accountingSections: ModuleExperienceSection[] = [
  {
    eyebrow: 'Accounting temple',
    title: 'Record to Report',
    description: 'One governed ledger domain for the organization: accounts, journals, posted ledger, close, statements and audit evidence.',
    cards: [
      { label: 'Command', title: 'Accounting Command Center', description: 'Authenticated view of accounting state across the same organization boundary.', to: '/finance/accounting/dashboard' },
      { label: 'COA', title: 'Chart of Accounts', description: 'Canonical account structure and active state.', to: '/finance/accounting/chart-of-accounts' },
      { label: 'GL', title: 'General Ledger', description: 'Posted debit and credit activity derived from journal lines.', to: '/finance/accounting/general-ledger' },
      { label: 'Journals', title: 'Journal Entries', description: 'Journal state, balanced lines and reversal lineage in read mode while current write RPCs remain gated.', to: '/finance/accounting/journal-entries' },
      { label: 'Close', title: 'Period Close', description: 'Period readiness and close-task evidence from the canonical accounting scope.', to: '/finance/accounting/period-close' },
      { label: 'Statements', title: 'Financial Reports', description: 'Trial Balance, Profit & Loss and Balance Sheet from the same posted ledger.', to: '/finance/accounting/reports' }
    ]
  },
  {
    eyebrow: 'Accounting operations',
    title: 'Money in, money out, cash and evidence',
    description: 'Operational workflows stay inside their proper domain but converge on the same Accounting source of truth.',
    cards: [
      { label: 'AP', title: 'Accounts Payable', description: 'Vendor obligations, aging, approvals and payment application state.', to: '/finance/accounting/accounts-payable' },
      { label: 'AR', title: 'Accounts Receivable', description: 'Customer invoicing, balances and governed payment recording.', to: '/finance/accounting/accounts-receivable' },
      { label: 'P2P', title: 'Procure to Pay', description: 'Purchasing and inventory receiving connect to Accounting without duplicating the ledger.', to: '/inventory/procure-to-pay' },
      { label: 'Treasury', title: 'Bank & Cash', description: 'Registered bank/cash records and imported transaction evidence.', to: '/finance/accounting/bank-cash' },
      { label: 'Reconcile', title: 'Bank Reconciliation', description: 'Statement-to-ledger sessions, readiness and unresolved exceptions.', to: '/finance/accounting/reconciliation' },
      { label: 'Industry', title: 'Automotive Sales Reporting', description: 'Dealership reporting using Accounting reporting contracts.', to: '/finance/accounting/reports/automotive-sales' }
    ]
  },
  {
    eyebrow: 'Governance and connected finance',
    title: 'One source of truth, multiple governed consumers',
    description: 'Tax, Payroll, FP&A, consolidation and operating modules consume Accounting evidence without becoming parallel books.',
    cards: [
      { label: 'Audit', title: 'Audit Trail', description: 'Organization-scoped accounting changes and traceable record history.', to: '/finance/accounting/audit-trail' },
      { label: 'Settings', title: 'Accounting Settings', description: 'Fiscal year, base currency, basis and control-account configuration in read mode.', to: '/finance/accounting/settings' },
      { label: 'Tax', title: 'ATLAS Tax', description: 'Tax remains a finance compliance domain connected to governed accounting evidence.', to: '/tax' },
      { label: 'Payroll', title: 'ATLAS Payroll', description: 'Payroll remains a people/pay domain whose approved financial impact connects to Accounting.', to: '/payroll' },
      { label: 'Assets', title: 'Fixed Assets', description: 'Recovered historical surface remains closed until the current canonical asset table and depreciation posting path are verified.', status: 'Evidence gate active' }
    ]
  }
];

export function EnterpriseExperiencePage() {
  return (
    <ModuleExperiencePage
      eyebrow="ATLAS Enterprise Suite"
      title="One governed enterprise ecosystem"
      description="Finance, CRM, Payroll, Health, Creator and operational verticals share one shell, organization context and execution boundary."
      narrative="One operating system for governed enterprise work."
      visualReference="universe"
      actions={[
        { label: 'Open Finance', to: '/finance' },
        { label: 'Open CRM', to: '/crm', variant: 'secondary' }
      ]}
      sections={enterpriseSections}
      statusNote="Only implemented ATLAS routes are active. Planned or incomplete commercial capabilities remain visibly gated until their code, data contracts, permissions and tests exist."
    />
  );
}

export function BusinessExperiencePage() {
  return (
    <ModuleExperiencePage
      eyebrow="ATLAS Business Suite"
      title="Business Suite"
      description="Connected growth, customer, creative and publishing operations inside one governed organization."
      narrative="Growth operations, customer workflows and governed publishing under one enterprise context."
      visualReference="modules"
      actions={[
        { label: 'Open Publishing Workspace', to: '/business/growth/social-publisher' },
        { label: 'Open CRM', to: '/crm', variant: 'secondary' }
      ]}
      sections={businessSections}
      statusNote="Channel connections remain unavailable until the organization authorizes the corresponding external accounts and provider readiness is verified."
    />
  );
}

export function FinanceExperiencePage() {
  return (
    <ModuleExperiencePage
      eyebrow="ATLAS Finance"
      title="Finance"
      description="Governed financial operations inside the shared ATLAS organization and permission model."
      narrative="Finance intelligence, execution and control."
      visualReference="modules"
      actions={[{ label: 'Open Accounting', to: '/finance/accounting' }]}
      sections={financeSections}
      statusNote="Finance totals and readiness state are shown only when they come from the authenticated organization through Supabase RLS. External banking and payment execution remain fail-closed until the organization authorizes and verifies those providers."
    >
      <FinanceControlCenterPanel />
    </ModuleExperiencePage>
  );
}

export function AccountingExperiencePage() {
  return (
    <ModuleExperiencePage
      eyebrow="ATLAS Finance / Accounting"
      title="Accounting Ecosystem"
      description="The financial temple inside ATLAS Finance: one governed accounting source of truth with operational workspaces and connected finance domains around the same tenant, permissions and audit boundary."
      narrative="One set of books. Many governed workflows. No parallel ledgers."
      visualReference="modules"
      actions={[
        { label: 'Open Accounting Command Center', to: '/finance/accounting/dashboard' },
        { label: 'Open General Ledger', to: '/finance/accounting/general-ledger', variant: 'secondary' }
      ]}
      sections={accountingSections}
      statusNote="Read surfaces use authenticated organization-scoped data. Mutation-only capabilities remain fail-closed unless their current backend/RPC contract is verified; Fixed Assets remains gated pending canonical data-path evidence."
    />
  );
}
