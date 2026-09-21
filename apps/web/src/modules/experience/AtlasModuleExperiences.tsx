import { ModuleExperiencePage, type ModuleExperienceSection } from '../../components/ModuleExperiencePage';

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
    eyebrow: 'Commercial expansion',
    title: 'Finance depth without false readiness',
    description: 'Capabilities without a complete canonical route remain visible as governed gates, not fake screens.',
    cards: [
      { label: 'Receivables', title: 'Accounts Receivable', description: 'Live customer invoicing with governed inventory issue, COGS and gross-margin posting for inventory-backed products.', to: '/finance/accounting/accounts-receivable', status: 'Canonical AR active' },
      { label: 'Ledger', title: 'General Ledger & Close', description: 'Broader journal and close work exists but is not yet proven as one complete current workflow.', status: 'Canonical workflow incomplete' },
      { label: 'Cash', title: 'Bank Reconciliation', description: 'Bank and cash reconciliation must be recovered into the current architecture before activation.', status: 'Canonical route not active' },
      { label: 'Treasury', title: 'Treasury & Forecasting', description: 'No live treasury metrics or banking connection is represented without an authorized source.', status: 'Provider and product gates apply' }
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
    eyebrow: 'Accounting architecture',
    title: 'Working books, governed workflows',
    description: 'The current Accounting surface links directly to the implemented operational slices and keeps unfinished commercial breadth explicit.',
    cards: [
      { label: 'Operations', title: 'Accounts Payable', description: 'Vendor obligations, aging, approvals and payment application state.', to: '/finance/accounting/accounts-payable' },
      { label: 'Inventory', title: 'Procure to Pay', description: 'Receive inventory by PO, preserve packing-slip evidence, three-way match vendor invoices and post Inventory/AP.', to: '/inventory/procure-to-pay' },
      { label: 'AR', title: 'Accounts Receivable', description: 'Customer invoices can relieve inventory and post Revenue, COGS and gross-margin evidence when products are inventory-backed.', to: '/finance/accounting/accounts-receivable' },
      { label: 'Reports', title: 'Automotive Sales Financial Reporting', description: 'Departmental dealership reporting with F&I, fixed operations, inventory and floorplan controls.', to: '/finance/accounting/reports/automotive-sales' }
    ]
  },
  {
    eyebrow: 'Accounting engine',
    title: 'Next canonical accounting capabilities',
    description: 'These capabilities are required for commercial completeness but remain gated until implementation, data contracts and tests converge in the canonical route graph.',
    cards: [
      { label: 'GL', title: 'General Ledger', description: 'Journal and ledger domain work requires final route and workflow reconciliation.', status: 'Reconciliation required' },
      { label: 'GL', title: 'General Ledger', description: 'Journal and ledger domain work requires final route and workflow reconciliation.', status: 'Reconciliation required' },
      { label: 'Cash', title: 'Bank Reconciliation', description: 'Cash and bank matching remains gated until verified accounting capability is recovered into the current architecture.', status: 'Canonical route not active' },
      { label: 'Close', title: 'Period Close', description: 'A complete governed close workflow is not yet proven in the canonical product surface.', status: 'Commercial workflow incomplete' }
    ]
  },
  {
    eyebrow: 'Governance',
    title: 'Auditability before automation',
    description: 'Accounting automation must preserve tenant scope, authorization, evidence and traceable state transitions.',
    cards: [
      { label: 'Controls', title: 'Permission boundary', description: 'Existing ATLAS identity and role controls remain the authorization source.' },
      { label: 'Audit', title: 'Traceable actions', description: 'Sensitive operations continue to require auditable execution paths.' },
      { label: 'Data', title: 'No invented balances', description: 'Financial values must originate from configured records and authorized integrations.' }
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
      actions={[{ label: 'Open Accounting', to: '/finance/accounting' }]}
      sections={financeSections}
      statusNote="No revenue, cash, banking or forecasting value is presented as live unless it comes from an authorized configured source."
    />
  );
}

export function AccountingExperiencePage() {
  return (
    <ModuleExperiencePage
      eyebrow="ATLAS Accounting"
      title="Accounting"
      description="Working accounting slices use the same governed tenant scope, permissions and reporting contracts as the rest of ATLAS."
      narrative="Accounting intelligence with governed execution."
      actions={[
        { label: 'Accounts Payable', to: '/finance/accounting/accounts-payable' },
        { label: 'Automotive Sales Report', to: '/finance/accounting/reports/automotive-sales', variant: 'secondary' }
      ]}
      sections={accountingSections}
      statusNote="Inactive accounting capabilities are shown as readiness gates instead of links so ATLAS never implies a workflow exists before it is implemented and verified."
    />
  );
}
