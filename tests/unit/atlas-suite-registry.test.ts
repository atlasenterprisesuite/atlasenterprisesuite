import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => (existsSync(path) ? readFileSync(path, 'utf8') : '');

const registry = read('apps/web/src/modules/registry.ts');
const resolver = read('apps/web/src/extensions/resolveAtlasExtension.tsx');
const suite = read('apps/web/src/modules/integration/AtlasSuitePage.tsx');
const hubs = read('apps/web/src/modules/integration/AtlasIntegrationHubs.tsx');

describe('ATLAS A-Z canonical integration', () => {
  it('surfaces one searchable A-Z module directory', () => {
    expect(suite).toContain('ATLAS Suite A-Z');
    expect(suite).toContain('ATLAS_MODULES');
    expect(suite).toContain('Search modules');
    expect(registry).toContain("{ to: '/suite', label: 'All Modules' }");
    expect(resolver).toContain("pathname === '/suite'");
    expect(resolver).toContain('<AtlasSuitePage />');
  });

  it('reconciles historical A-Z domains onto the modern router without restoring the legacy shell', () => {
    const routes = ['/automations', '/people', '/revenue', '/site-review', '/telecom', '/release'];
    for (const route of routes) {
      expect(registry, route).toContain(`route: '${route}'`);
      expect(resolver, route).toContain(`pathname === '${route}'`);
    }

    for (const component of [
      'AutomationsIntegrationHub',
      'PeopleIntegrationHub',
      'RevenueIntegrationHub',
      'SiteReviewIntegrationHub',
      'TelecomIntegrationHub',
      'ReleaseControlIntegrationHub'
    ]) {
      expect(hubs).toContain(`export function ${component}`);
      expect(resolver).toContain(`<RequireAtlasIdentity><${component} /></RequireAtlasIdentity>`);
    }
  });

  it('registers modern Accounting and Insurance truthfully', () => {
    expect(registry).toContain("id: 'accounting'");
    expect(registry).toContain("route: '/finance/accounting'");
    expect(registry).toContain("id: 'insurance'");
    expect(registry).toContain("route: '/insurance'");
    expect(registry).toContain("readiness: 'partial'");
  });

  it('keeps migrated domains fail-closed instead of claiming provider completion', () => {
    expect(hubs).toContain('Migration gate');
    expect(hubs).toContain('External gate');
    expect(hubs).toContain('remain fail-closed');
    expect(suite).toContain('never present external or incomplete capabilities as live');
  });
});
