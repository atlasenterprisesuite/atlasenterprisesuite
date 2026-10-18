import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  ANALYTICS_SOURCES,
  METRIC_CATALOG,
  analyticsReadinessSummary,
  evaluateMetricReadiness
} from '../../packages/analytics/src/index';

describe('ATLAS Business Analytics', () => {
  it('never promotes demo or unverified sources to production metrics', () => {
    const summary = analyticsReadinessSummary();
    expect(summary.demoSources).toBeGreaterThan(0);
    expect(summary.productionMetricCount).toBe(0);

    for (const metric of METRIC_CATALOG) {
      const readiness = evaluateMetricReadiness(metric);
      expect(readiness.ready).toBe(false);
    }
  });

  it('keeps every analytics source linked to a real ATLAS route', () => {
    for (const source of ANALYTICS_SOURCES) {
      expect(source.route.startsWith('/')).toBe(true);
      expect(source.evidence.length).toBeGreaterThan(12);
    }
  });

  it('enforces production lineage and verified-source constraints in persistence', () => {
    const sql = readFileSync('supabase/migrations/20260929150000_atlas_business_analytics_core.sql', 'utf8');
    expect(sql).toContain("('analytics.read'");
    expect(sql).toContain("('analytics.manage'");
    expect(sql).toContain("evidence_scope <> 'production' or source_verified = true");
    expect(sql).toContain("lineage <> '{}'::jsonb");
    expect(sql).toContain('enable row level security');
    expect(sql).toContain("has_identity_permission(org_id,'analytics.read')");
    expect(sql).toContain("has_identity_permission(org_id,'analytics.manage')");
  });

  it('exposes a complete governed navigation surface', () => {
    const page = readFileSync('apps/web/src/modules/analytics/AnalyticsRoutes.tsx', 'utf8');
    for (const route of [
      '/analytics',
      '/analytics/metrics',
      '/analytics/sources',
      '/analytics/insights',
      '/analytics/forecasting',
      '/analytics/governance'
    ]) {
      expect(page).toContain(route);
    }
    expect(page).toContain('No production insights available yet.');
    expect(page).toContain('never fabricated');
  });
});
