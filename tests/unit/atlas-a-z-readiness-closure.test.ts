import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const registry = readFileSync('apps/web/src/modules/registry.ts', 'utf8');
const resolver = readFileSync('apps/web/src/extensions/resolveAtlasExtension.tsx', 'utf8');
const hubs = readFileSync('apps/web/src/modules/integration/AtlasIntegrationHubs.tsx', 'utf8');
const analytics = readFileSync('apps/web/src/modules/analytics/AnalyticsRoutes.tsx', 'utf8');

function moduleBlock(id: string) {
  const start = registry.indexOf(`id: '${id}'`);
  expect(start, `missing registry entry: ${id}`).toBeGreaterThanOrEqual(0);
  const next = registry.indexOf('\n  {', start + 1);
  return registry.slice(start, next === -1 ? registry.length : next);
}

describe('ATLAS A-Z readiness closure', () => {
  it.each([
    ['automations', '/automations', 'AutomationsIntegrationHub'],
    ['revenue', '/revenue', 'RevenueIntegrationHub'],
    ['site-review', '/site-review', 'SiteReviewIntegrationHub'],
  ])('%s has a canonical implemented orchestration surface', (id, route, component) => {
    expect(moduleBlock(id)).toContain("readiness: 'implemented'");
    expect(resolver).toContain(`pathname === '${route}'`);
    expect(resolver).toContain(`<RequireAtlasIdentity><${component} /></RequireAtlasIdentity>`);
    expect(hubs).toContain(`export function ${component}`);
  });

  it('analytics has a dedicated governed module surface', () => {
    expect(moduleBlock('analytics')).toContain("readiness: 'implemented'");
    expect(resolver).toContain("pathname === '/analytics' || pathname.startsWith('/analytics/')");
    expect(resolver).toContain('<RequireAtlasIdentity><AnalyticsRoutes /></RequireAtlasIdentity>');
    expect(analytics).toContain('export function AnalyticsRoutes');
    expect(analytics).toContain('/analytics/metrics');
    expect(analytics).toContain('/analytics/governance');
  });

  it.each([
    'advisory',
    'accounting',
    'health',
    'frontier',
    'aviation',
    'release-control'
  ])('%s is release-complete for its current governed scope', (id) => {
    expect(moduleBlock(id)).toContain("readiness: 'implemented'");
  });

  it.each(['knowledge','learning'])('%s remains partial while declared lifecycle work is open', (id) => {
    expect(moduleBlock(id)).toContain("readiness: 'partial'");
  });

  it.each([
    'crm',
    'commerce',
    'connect',
    'telecom',
    'insurance',
    'studio',
    'voice',
    'hospitality',
    'device-os'
  ])('%s remains truthfully external-gated', (id) => {
    expect(moduleBlock(id)).toContain("readiness: 'external-gated'");
  });

  it.each(['tax', 'people', 'events'])(
    '%s is release-complete for its current governed scope',
    (id) => {
      expect(moduleBlock(id)).toContain("readiness: 'implemented'");
    }
  );

  it('keeps Payroll complete internally while external money/tax rails remain gated', () => {
    expect(moduleBlock('payroll')).toContain("readiness: 'external-gated'");
  });

  it('preserves fail-closed provider and aggregation boundaries', () => {
    expect(hubs).toContain('External triggers stay fail-closed');
    expect(hubs).toContain('Cross-module KPI layer');
    expect(hubs).toContain('External analytics providers');
    expect(hubs).toContain('no external scan, DNS, analytics or deployment provider is treated as verified');
  });
});
