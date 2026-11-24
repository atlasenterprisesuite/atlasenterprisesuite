export type AnalyticsSourceState =
  | 'verified'
  | 'demo'
  | 'verification-required'
  | 'external-gated'
  | 'contract-gated';

export type AnalyticsSource = {
  id: string;
  name: string;
  domain: string;
  route: string;
  state: AnalyticsSourceState;
  liveEligible: boolean;
  evidence: string;
};

export type MetricStatus = 'available' | 'gated';

export type MetricDefinition = {
  id: string;
  name: string;
  category: 'finance' | 'revenue' | 'customer' | 'operations' | 'people' | 'growth';
  description: string;
  unit: 'currency' | 'percent' | 'count' | 'days' | 'ratio' | 'duration';
  requiredSources: readonly string[];
  status: MetricStatus;
};

export const ANALYTICS_SOURCES: readonly AnalyticsSource[] = [
  {
    id: 'finance-automotive-demo',
    name: 'Automotive Sales Reporting',
    domain: 'Finance',
    route: '/finance/accounting/reports/automotive-sales',
    state: 'demo',
    liveEligible: false,
    evidence: 'Repository-backed demonstration dataset; not production tenant data.'
  },
  {
    id: 'commerce',
    name: 'ATLAS Commerce',
    domain: 'Commerce',
    route: '/commerce',
    state: 'verification-required',
    liveEligible: true,
    evidence: 'Canonical organization-scoped commerce surface; runtime connection must be verified.'
  },
  {
    id: 'crm',
    name: 'ATLAS CRM',
    domain: 'Customers',
    route: '/crm',
    state: 'external-gated',
    liveEligible: true,
    evidence: 'Provider-backed CRM data remains conditional on authorized organization connection.'
  },
  {
    id: 'social',
    name: 'Social Command Center',
    domain: 'Growth',
    route: '/studio/social',
    state: 'external-gated',
    liveEligible: true,
    evidence: 'Imported social metrics are valid only when an authorized source exists.'
  },
  {
    id: 'payroll',
    name: 'ATLAS Payroll',
    domain: 'People',
    route: '/payroll',
    state: 'external-gated',
    liveEligible: true,
    evidence: 'Payroll operational data is governed separately from external money and tax rails.'
  },
  {
    id: 'inventory',
    name: 'ATLAS Inventory & Purchasing',
    domain: 'Operations',
    route: '/inventory/procure-to-pay',
    state: 'verification-required',
    liveEligible: true,
    evidence: 'Canonical inventory and procure-to-pay surface; analytics projection requires verified lineage.'
  }
] as const;

export const METRIC_CATALOG: readonly MetricDefinition[] = [
  {
    id: 'revenue',
    name: 'Revenue',
    category: 'revenue',
    description: 'Recognized or operational revenue according to the owning source contract.',
    unit: 'currency',
    requiredSources: ['commerce'],
    status: 'gated'
  },
  {
    id: 'gross-margin',
    name: 'Gross Margin',
    category: 'finance',
    description: 'Revenue less direct cost, reconciled to the authoritative accounting or commerce source.',
    unit: 'percent',
    requiredSources: ['commerce', 'inventory'],
    status: 'gated'
  },
  {
    id: 'cash-conversion-cycle',
    name: 'Cash Conversion Cycle',
    category: 'finance',
    description: 'Working-capital cycle across receivables, inventory and payables.',
    unit: 'days',
    requiredSources: ['inventory'],
    status: 'gated'
  },
  {
    id: 'pipeline-conversion',
    name: 'Pipeline Conversion',
    category: 'customer',
    description: 'Qualified opportunity to completed customer conversion.',
    unit: 'percent',
    requiredSources: ['crm'],
    status: 'gated'
  },
  {
    id: 'customer-retention',
    name: 'Customer Retention',
    category: 'customer',
    description: 'Share of customers retained across a defined comparable period.',
    unit: 'percent',
    requiredSources: ['crm', 'commerce'],
    status: 'gated'
  },
  {
    id: 'inventory-turnover',
    name: 'Inventory Turnover',
    category: 'operations',
    description: 'Cost of goods sold relative to average inventory for the selected period.',
    unit: 'ratio',
    requiredSources: ['inventory'],
    status: 'gated'
  },
  {
    id: 'fulfillment-time',
    name: 'Order Fulfillment Time',
    category: 'operations',
    description: 'Elapsed time from accepted order to fulfilled order.',
    unit: 'duration',
    requiredSources: ['commerce'],
    status: 'gated'
  },
  {
    id: 'labor-cost-rate',
    name: 'Labor Cost Rate',
    category: 'people',
    description: 'Payroll labor cost relative to the selected operating denominator.',
    unit: 'percent',
    requiredSources: ['payroll'],
    status: 'gated'
  },
  {
    id: 'social-growth',
    name: 'Social Growth',
    category: 'growth',
    description: 'Source-scoped follower or audience growth from an authorized social provider.',
    unit: 'percent',
    requiredSources: ['social'],
    status: 'gated'
  }
] as const;

export function sourceById(id: string) {
  return ANALYTICS_SOURCES.find((source) => source.id === id) ?? null;
}

export function evaluateMetricReadiness(
  metric: MetricDefinition,
  sources: readonly AnalyticsSource[] = ANALYTICS_SOURCES
) {
  const missingSourceIds = metric.requiredSources.filter(
    (id) => !sources.some((source) => source.id === id)
  );
  const blockedSourceIds = metric.requiredSources.filter((id) => {
    const source = sources.find((candidate) => candidate.id === id);
    return Boolean(source && source.state !== 'verified' && source.state !== 'demo');
  });

  return {
    ready: missingSourceIds.length === 0 && blockedSourceIds.length === 0,
    missingSourceIds,
    blockedSourceIds
  };
}

export function analyticsReadinessSummary(sources: readonly AnalyticsSource[] = ANALYTICS_SOURCES) {
  const verified = sources.filter((source) => source.state === 'verified').length;
  const demo = sources.filter((source) => source.state === 'demo').length;
  const gated = sources.length - verified - demo;
  return {
    totalSources: sources.length,
    verifiedSources: verified,
    demoSources: demo,
    gatedSources: gated,
    productionMetricCount: METRIC_CATALOG.filter(
      (metric) => evaluateMetricReadiness(metric, sources).ready &&
        metric.requiredSources.every((id) => sourceById(id)?.state === 'verified')
    ).length
  };
}

/** Local, read-only intent planning. Never authorizes or executes data access. */
const QUESTION_ALIASES: Readonly<Record<string, readonly string[]>> = {
  revenue: ['revenue', 'ingresos'],
  'gross-margin': ['gross margin', 'margen bruto'],
  'cash-conversion-cycle': ['cash conversion cycle', 'ciclo de conversion de efectivo'],
  'pipeline-conversion': ['pipeline conversion', 'conversion de oportunidades'],
  'customer-retention': ['customer retention', 'retencion de clientes'],
  'inventory-turnover': ['inventory turnover', 'rotacion de inventario'],
  'fulfillment-time': ['fulfillment time', 'tiempo de cumplimiento'],
  'labor-cost-rate': ['labor cost rate', 'tasa de costo laboral'],
  'social-growth': ['social growth', 'crecimiento social']
};

export function planAnalyticsQuestion(question: string) {
  const normalized = question.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const tokens = new Set(normalized.split(' '));
  const forbidden = ['delete', 'drop', 'truncate', 'insert', 'update', 'alter', 'select', 'execute', 'grant', 'revoke', 'eliminar', 'borrar', 'actualizar', 'ejecutar', 'modificar'];
  const supported = question.length <= 500 && normalized.length > 0 &&
    !forbidden.some(word => tokens.has(word));
  const phrase = ' ' + normalized + ' ';
  const metrics = supported ? METRIC_CATALOG.filter(metric =>
    (QUESTION_ALIASES[metric.id] ?? []).some(alias => phrase.includes(' ' + alias + ' '))
  ).map(metric => ({
    id: metric.id,
    name: metric.name,
    definition: metric.description,
    unit: metric.unit,
    requiredSources: metric.requiredSources,
    blockedSources: metric.requiredSources.filter(id => {
      const source = sourceById(id);
      return !source || source.state !== 'verified' || !source.liveEligible;
    }),
    value: null
  })) : [];
  return {
    status: metrics.length === 0 ? 'unsupported' as const : 'source-gated' as const,
    metrics,
    executionAllowed: false as const
  };
}
