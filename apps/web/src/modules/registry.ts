export type AtlasModuleReadiness = 'implemented' | 'partial' | 'external-gated';

export type AtlasModuleDefinition = {
  id: string;
  title: string;
  navLabel: string;
  area: string;
  route: string;
  readiness: AtlasModuleReadiness;
  requiresAuth: boolean;
  description: string;
  showInNavigation: boolean;
};

export const ATLAS_MODULES: readonly AtlasModuleDefinition[] = [
  {
    id: 'work',
    title: 'ATLAS Work Soberano',
    navLabel: 'Work',
    area: 'Platform',
    route: '/work',
    readiness: 'implemented',
    requiresAuth: true,
    description: 'Governed sovereign work orchestration over the Universal Execution Engine.',
    showInNavigation: true
  },
  {
    id: 'automations',
    title: 'ATLAS Automations',
    navLabel: 'Automations',
    area: 'Platform',
    route: '/automations',
    readiness: 'partial',
    requiresAuth: true,
    description: 'Governed automation orchestration over ATLAS Work, execution readiness and assistant intelligence.',
    showInNavigation: false
  },
  {
    id: 'assistant',
    title: 'ATLAS Assistant',
    navLabel: 'Assistant',
    area: 'Intelligence',
    route: '/assistant',
    readiness: 'implemented',
    requiresAuth: true,
    description: 'Governed multi-provider intelligence workspace with conversation history and verified provider readiness.',
    showInNavigation: true
  },
  {
    id: 'business',
    title: 'Business Suite',
    navLabel: 'Business',
    area: 'Business',
    route: '/business',
    readiness: 'implemented',
    requiresAuth: false,
    description: 'Growth, publishing and connected business operations.',
    showInNavigation: true
  },
  {
    id: 'revenue',
    title: 'ATLAS Revenue Operations',
    navLabel: 'Revenue',
    area: 'Business',
    route: '/revenue',
    readiness: 'partial',
    requiresAuth: true,
    description: 'Canonical revenue operations across CRM, commerce, business growth and financial reconciliation.',
    showInNavigation: false
  },
  {
    id: 'advisory',
    title: 'ATLAS Advisory Office',
    navLabel: 'Advisory',
    area: 'Business',
    route: '/advisory',
    readiness: 'partial',
    requiresAuth: true,
    description: 'Firm, client, engagement and Business Launch 360 operations with governed external boundaries.',
    showInNavigation: true
  },
  {
    id: 'finance',
    title: 'Finance',
    navLabel: 'Finance',
    area: 'Finance',
    route: '/finance',
    readiness: 'implemented',
    requiresAuth: false,
    description: 'Governed accounting and financial operations.',
    showInNavigation: true
  },
  {
    id: 'accounting',
    title: 'ATLAS Accounting',
    navLabel: 'Accounting',
    area: 'Finance',
    route: '/finance/accounting',
    readiness: 'partial',
    requiresAuth: false,
    description: 'Canonical accounting entry point across payable, reporting and governed finance workflows.',
    showInNavigation: false
  },
  {
    id: 'crm',
    title: 'CRM',
    navLabel: 'CRM',
    area: 'Business',
    route: '/crm',
    readiness: 'external-gated',
    requiresAuth: true,
    description: 'Organization-scoped CRM with provider-backed integrations.',
    showInNavigation: true
  },
  {
    id: 'commerce',
    title: 'ATLAS Commerce',
    navLabel: 'Commerce',
    area: 'Business',
    route: '/commerce',
    readiness: 'partial',
    requiresAuth: true,
    description: 'Governed catalog, checkout and order operations with fail-closed providers.',
    showInNavigation: true
  },
  {
    id: 'connect',
    title: 'ATLAS Connect',
    navLabel: 'Connect',
    area: 'Communications',
    route: '/connect',
    readiness: 'external-gated',
    requiresAuth: true,
    description: 'Governed communications and carrier-provider connections with truthful capability gates.',
    showInNavigation: true
  },
  {
    id: 'telecom',
    title: 'ATLAS Telecom',
    navLabel: 'Telecom',
    area: 'Communications',
    route: '/telecom',
    readiness: 'external-gated',
    requiresAuth: true,
    description: 'Canonical telecom entry point over Connect, Device OS and Voice with carrier actions fail-closed.',
    showInNavigation: false
  },
  {
    id: 'people',
    title: 'ATLAS People',
    navLabel: 'People',
    area: 'People',
    route: '/people',
    readiness: 'partial',
    requiresAuth: true,
    description: 'People operations entry point spanning payroll, learning and governed workforce administration.',
    showInNavigation: false
  },
  {
    id: 'payroll',
    title: 'ATLAS Payroll',
    navLabel: 'Payroll',
    area: 'People',
    route: '/payroll',
    readiness: 'partial',
    requiresAuth: true,
    description: 'Governed payroll workspace and commercial payroll foundation.',
    showInNavigation: true
  },
  {
    id: 'learning',
    title: 'ATLAS Learning',
    navLabel: 'Learning',
    area: 'People',
    route: '/learning',
    readiness: 'partial',
    requiresAuth: false,
    description: 'Structured learning, practice and measurable progress.',
    showInNavigation: true
  },
  {
    id: 'health',
    title: 'ATLAS Health',
    navLabel: 'Health',
    area: 'Health',
    route: '/health',
    readiness: 'partial',
    requiresAuth: false,
    description: 'Research and wellbeing tooling with explicit evidence boundaries.',
    showInNavigation: true
  },
  {
    id: 'insurance',
    title: 'ATLAS Insurance',
    navLabel: 'Insurance',
    area: 'Protection',
    route: '/insurance',
    readiness: 'partial',
    requiresAuth: true,
    description: 'Secure insurance access, member and policy verification, and governed coverage workflows.',
    showInNavigation: false
  },
  {
    id: 'studio',
    title: 'ATLAS Studio',
    navLabel: 'Creator',
    area: 'Creative',
    route: '/studio',
    readiness: 'external-gated',
    requiresAuth: true,
    description: 'Governed media creation and provider-aware execution.',
    showInNavigation: true
  },
  {
    id: 'site-review',
    title: 'ATLAS Site Review',
    navLabel: 'Site Review',
    area: 'Creative',
    route: '/site-review',
    readiness: 'partial',
    requiresAuth: true,
    description: 'Governed review entry point for web launch, content intelligence and execution evidence.',
    showInNavigation: false
  },
  {
    id: 'voice',
    title: 'ATLAS Voice',
    navLabel: 'Voice',
    area: 'Creative',
    route: '/voice',
    readiness: 'partial',
    requiresAuth: true,
    description: 'Universal governed voice control, conversational intelligence and agent workspace across ATLAS.',
    showInNavigation: true
  },
  {
    id: 'events',
    title: 'ATLAS Events & Entertainment',
    navLabel: 'Events',
    area: 'Entertainment',
    route: '/events',
    readiness: 'partial',
    requiresAuth: true,
    description: 'Governed live entertainment operations across talent, venues, production, commerce and settlement.',
    showInNavigation: true
  },
  {
    id: 'frontier',
    title: 'ATLAS FRONTIER',
    navLabel: 'Frontier',
    area: 'Entertainment',
    route: '/frontier',
    readiness: 'partial',
    requiresAuth: true,
    description: 'Governed sandbox vertical slice with server-authoritative progression, organization scope and append-only gameplay audit.',
    showInNavigation: true
  },
  {
    id: 'hospitality',
    title: 'ATLAS Hospitality',
    navLabel: 'Hospitality',
    area: 'Hospitality',
    route: '/hospitality',
    readiness: 'partial',
    requiresAuth: true,
    description: 'Hospitality operations with truthful provider access boundaries.',
    showInNavigation: true
  },
  {
    id: 'ride',
    title: 'ATLAS Ride',
    navLabel: 'Ride',
    area: 'Mobility',
    route: '/ride',
    readiness: 'implemented',
    requiresAuth: true,
    description: 'Governed mobility and driver-compliance workflows.',
    showInNavigation: true
  },
  {
    id: 'aviation',
    title: 'ATLAS Aviation',
    navLabel: 'Aviation',
    area: 'Mobility',
    route: '/mobility/aviation',
    readiness: 'partial',
    requiresAuth: true,
    description: 'Evidence-aware aircraft, certification and advanced-air-mobility intelligence.',
    showInNavigation: true
  },
  {
    id: 'galaxy',
    title: 'ATLAS Galaxy',
    navLabel: 'Galaxy',
    area: 'Platform',
    route: '/galaxy',
    readiness: 'implemented',
    requiresAuth: true,
    description: 'Spatial navigation and truthful module-state overview.',
    showInNavigation: true
  },
  {
    id: 'device-os',
    title: 'ATLAS Device OS',
    navLabel: 'Device OS',
    area: 'Platform',
    route: '/device-os',
    readiness: 'partial',
    requiresAuth: true,
    description: 'Governed software control plane for ATLAS phones, desktops, wearables, smart spaces and mobility hardware.',
    showInNavigation: true
  },
  {
    id: 'release-control',
    title: 'ATLAS Release Control',
    navLabel: 'Release',
    area: 'Platform',
    route: '/release',
    readiness: 'partial',
    requiresAuth: true,
    description: 'Internal release and production-readiness entry point for governed deployment evidence.',
    showInNavigation: false
  },
  {
    id: 'execution',
    title: 'Universal Execution',
    navLabel: 'Execution',
    area: 'Platform',
    route: '/execution/manager/readiness',
    readiness: 'implemented',
    requiresAuth: true,
    description: 'Guided execution, readiness and governed action orchestration.',
    showInNavigation: true
  }
] as const;

export const ATLAS_NAV_ITEMS = [
  { to: '/', label: 'Home' },
  { to: '/suite', label: 'All Modules' },
  ...ATLAS_MODULES
    .filter((module) => module.showInNavigation)
    .map((module) => ({ to: module.route, label: module.navLabel })),
  { to: '/finance/accounting/accounts-payable', label: 'Payables' },
  { to: '/finance/accounting/reports/automotive-sales', label: 'Automotive' }
] as const;
