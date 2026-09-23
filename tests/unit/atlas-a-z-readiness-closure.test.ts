import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const registry = readFileSync('apps/web/src/modules/registry.ts', 'utf8');
const resolver = readFileSync('apps/web/src/extensions/resolveAtlasExtension.tsx', 'utf8');
const hubs = readFileSync('apps/web/src/modules/integration/AtlasIntegrationHubs.tsx', 'utf8');

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
    ['analytics', '/analytics', 'AnalyticsIntegrationHub'],
    ['site-review', '/site-review', 'SiteReviewIntegrationHub'],
  ])('%s has a canonical implemented orchestration surface', (id, route, component) => {
    expect(moduleBlock(id)).toContain("readiness: 'implemented'");
    expect(resolver).toContain(`pathname === '${route}'`);
    expect(resolver).toContain(`<RequireAtlasIdentity><${component} /></RequireAtlasIdentity>`);
    expect(hubs).toContain(`export function ${component}`);
  });

  it('preserves fail-closed provider and aggregation boundaries', () => {
    expect(hubs).toContain('External triggers stay fail-closed');
    expect(hubs).toContain('Cross-module KPI layer');
    expect(hubs).toContain('External analytics providers');
    expect(hubs).toContain('no external scan, DNS, analytics or deployment provider is treated as verified');
  });
});
