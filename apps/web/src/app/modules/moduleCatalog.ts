import type { AtlasPermission } from '../../../../../packages/core/src';

export type AtlasModuleCategory =
  | 'people'
  | 'finance'
  | 'operations'
  | 'industry'
  | 'intelligence'
  | 'connectivity'
  | 'collaboration'
  | 'platform'
  | 'creative'
  | 'mobility'
  | 'global';

export type AtlasModuleImplementationState =
  | 'implemented'
  | 'partial'
  | 'configuration_required'
  | 'blocked';

export type AtlasModuleDefinition = Readonly<{
  id: string;
  displayName: string;
  route: `/app/${string}`;
  category: AtlasModuleCategory;
  description: string;
  moduleCodes: readonly string[];
  permissions?: readonly AtlasPermission[];
  legacyRoute?: string;
  implementationState: AtlasModuleImplementationState;
}>;

function defineModule(module: AtlasModuleDefinition): AtlasModuleDefinition {
  return Object.freeze({
    ...module,
    moduleCodes: Object.freeze([...module.moduleCodes]),
    permissions: module.permissions ? Object.freeze([...module.permissions]) : undefined,
  });
}

export const ATLAS_MODULE_CATALOG: readonly AtlasModuleDefinition[] = Object.freeze([
  defineModule({
    id: 'hr',
    displayName: 'ATLAS HR',
    route: '/app/hr',
    category: 'people',
    description: 'Recruiting, employee operations, assessments, performance and workforce intelligence.',
    moduleCodes: ['hr'],
    permissions: ['hr.read', 'hr.write'],
    legacyRoute: '/people',
    implementationState: 'implemented',
  }),
  defineModule({
    id: 'payroll',
    displayName: 'ATLAS Payroll',
    route: '/app/payroll',
    category: 'people',
    description: 'Payroll runs, timecards, taxes, review workflows and workforce payment operations.',
    moduleCodes: ['payroll'],
    permissions: ['payroll.read', 'payroll.self'],
    legacyRoute: '/people/payroll',
    implementationState: 'implemented',
  }),
  defineModule({
    id: 'finance',
    displayName: 'ATLAS Finance',
    route: '/app/finance',
    category: 'finance',
    description: 'Accounting, receivables, payables, general ledger, cash flow and financial controls.',
    moduleCodes: ['finance', 'accounting'],
    permissions: ['accounting.read'],
    legacyRoute: '/finance',
    implementationState: 'implemented',
  }),
  defineModule({
    id: 'erp',
    displayName: 'ATLAS ERP',
    route: '/app/erp',
    category: 'operations',
    description: 'Enterprise operations spanning customers, sales, purchasing, inventory, POS and projects.',
    moduleCodes: ['crm', 'inventory', 'pos', 'projects'],
    permissions: ['revenue.crm.read', 'revenue.sales.read', 'revenue.purchasing.read', 'revenue.inventory.read', 'revenue.pos.read'],
    legacyRoute: '/operations',
    implementationState: 'implemented',
  }),
  defineModule({
    id: 'pay-wallet',
    displayName: 'ATLAS Pay & Wallet',
    route: '/app/pay-wallet',
    category: 'finance',
    description: 'Identity-scoped wallet and payment workflows with governed provider readiness.',
    moduleCodes: ['wallet', 'atlas-pay'],
    implementationState: 'partial',
  }),
  defineModule({
    id: 'health',
    displayName: 'ATLAS Health',
    route: '/app/health',
    category: 'industry',
    description: 'Health operations and governed research surfaces without fabricating clinical connectivity.',
    moduleCodes: ['health'],
    legacyRoute: '/health',
    implementationState: 'implemented',
  }),
  defineModule({
    id: 'education',
    displayName: 'ATLAS Education',
    route: '/app/education',
    category: 'industry',
    description: 'Learners, assessments, courses, credentials and education operations.',
    moduleCodes: ['education'],
    implementationState: 'partial',
  }),
  defineModule({
    id: 'analytics',
    displayName: 'ATLAS Analytics',
    route: '/app/analytics',
    category: 'intelligence',
    description: 'Governed KPIs, reports and AI-assisted analysis tied to authorized organization data.',
    moduleCodes: ['analytics', 'intelligence'],
    implementationState: 'partial',
  }),
  defineModule({
    id: 'connect',
    displayName: 'ATLAS Connect',
    route: '/app/connect',
    category: 'connectivity',
    description: 'Business communications and provider-backed connectivity with explicit connection state.',
    moduleCodes: ['connect'],
    implementationState: 'blocked',
  }),
  defineModule({
    id: 'documents',
    displayName: 'ATLAS Documents',
    route: '/app/documents',
    category: 'collaboration',
    description: 'Governed document workflows for contracts, reports, invoices and authorized organization records.',
    moduleCodes: ['documents'],
    implementationState: 'partial',
  }),
  defineModule({
    id: 'knowledge',
    displayName: 'Knowledge Atlas',
    route: '/app/knowledge',
    category: 'intelligence',
    description: 'Connected organizational knowledge, evidence, policies, training and reusable context.',
    moduleCodes: ['knowledge'],
    implementationState: 'partial',
  }),
  defineModule({
    id: 'security',
    displayName: 'ATLAS Security',
    route: '/app/security',
    category: 'platform',
    description: 'Identity-aware security controls, audit evidence, access posture and production safeguards.',
    moduleCodes: ['security'],
    implementationState: 'partial',
  }),
  defineModule({
    id: 'identity',
    displayName: 'ATLAS Identity',
    route: '/app/identity',
    category: 'platform',
    description: 'Identity, organization context, permissions and authenticated application access.',
    moduleCodes: ['identity'],
    implementationState: 'implemented',
  }),
  defineModule({
    id: 'projects',
    displayName: 'ATLAS Projects',
    route: '/app/projects',
    category: 'operations',
    description: 'Project coordination, work queues, milestones, tasks, reviews and execution evidence.',
    moduleCodes: ['projects'],
    permissions: ['revenue.projects.read'],
    legacyRoute: '/operations',
    implementationState: 'implemented',
  }),
  defineModule({
    id: 'studio',
    displayName: 'ATLAS Studio',
    route: '/app/studio',
    category: 'creative',
    description: 'ATLAS-owned content, media and voice production surfaces with provider-gated generation.',
    moduleCodes: ['creator-studio', 'voice'],
    permissions: ['voice.personal.read'],
    legacyRoute: '/voice',
    implementationState: 'partial',
  }),
  defineModule({
    id: 'workbench',
    displayName: 'ATLAS Workbench',
    route: '/app/workbench',
    category: 'platform',
    description: 'Developer, provider, deployment and operating tools for building and validating the ATLAS platform.',
    moduleCodes: ['release-controller', 'automations', 'site-review', 'spatial'],
    permissions: ['forge.release.read', 'automation.read', 'site-review.read', 'spatial.read'],
    legacyRoute: '/release',
    implementationState: 'implemented',
  }),
  defineModule({
    id: 'ride',
    displayName: 'ATLAS RideOS',
    route: '/app/ride',
    category: 'mobility',
    description: 'Driver, ride, vehicle and mobility operations connected to governed finance and identity context.',
    moduleCodes: ['ride'],
    implementationState: 'partial',
  }),
  defineModule({
    id: 'global',
    displayName: 'ATLAS Global',
    route: '/app/global',
    category: 'global',
    description: 'Country-aware ATLAS editions and jurisdiction-specific configuration on the shared platform.',
    moduleCodes: ['global'],
    implementationState: 'configuration_required',
  }),
]);

export function findAtlasModule(moduleId: string) {
  return ATLAS_MODULE_CATALOG.find((module) => module.id === moduleId) ?? null;
}
