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
  const required = metric.requiredSources.map((id) => sources.find((source) => source.id === id));
  const missing = required.filter((source) => !source);
  const blocked = required.filter(
    (source) => source && source.state !== 'verified' && source.state !== 'demo'
  );

  return {
    ready: missing.length === 0 && blocked.length === 0,
    missingSourceIds: missing.map((_, index) => metric.requiredSources[index]),
    blockedSourceIds: blocked.map((source) => source?.id).filter(Boolean) as string[]
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
