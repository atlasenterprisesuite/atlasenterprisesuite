import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => (existsSync(path) ? readFileSync(path, 'utf8') : '');

const registry = read('apps/web/src/modules/registry.ts');
const resolver = read('apps/web/src/extensions/resolveAtlasExtension.tsx');
const suite = read('apps/web/src/modules/integration/AtlasSuitePage.tsx');
const suiteStyles = read('apps/web/src/modules/integration/atlas-suite.css');
const moduleVisuals = read('apps/web/src/modules/integration/moduleVisuals.ts');
const hubs = read('apps/web/src/modules/integration/AtlasIntegrationHubs.tsx');
const analytics = read('apps/web/src/modules/analytics/AnalyticsRoutes.tsx');
const app = read('apps/web/src/App.tsx');
const experiences = read('apps/web/src/modules/experience/AtlasModuleExperiences.tsx');

describe('ATLAS A-Z canonical integration', () => {
  it('surfaces one searchable A-Z module directory', () => {
    expect(suite).toContain('ATLAS Suite A-Z');
    expect(suite).toContain('ATLAS_MODULES');
    expect(suite).toContain('Search modules');
    expect(registry).toContain("{ to: '/suite', label: 'All Modules' }");
    expect(resolver).toContain("pathname === '/suite'");
    expect(resolver).toContain('<AtlasSuitePage />');
  });

  it('presents the suite as a module-identity visual product library before the A-Z directory', () => {
    expect(suite).toContain('Primary Systems');
    expect(suite).toContain('Explore A-Z');
    expect(suite).toContain('suite-hero');
    expect(suite).toContain('suite-primary-grid');
    expect(suite).toContain('suite-filter-bar');
    expect(suite).toContain('suite-module-card');
    expect(suite).toContain('getModuleVisual');
    expect(suite).not.toContain('COVER_ASSETS');
    expect(suite).not.toContain('% COVER_ASSETS.length');
    expect(moduleVisuals).toContain('export const MODULE_VISUALS');
    expect(suiteStyles).toContain('.suite-module-grid');
    expect(suiteStyles).toContain('repeat(4,minmax(0,1fr))');
    expect(suiteStyles).toContain('@media(max-width:760px)');
  });

  it('shows active evolution as an independent lifecycle axis', () => {
    expect(suite).toContain("module.evolution === 'active'");
    expect(suite).toContain('operational baseline');
    expect(suite).toContain('active evolution');
    expect(suite).not.toContain('<strong>{partial}</strong> partial');
  });

  it('reconciles historical A-Z domains onto the modern router without restoring the legacy shell', () => {
    const routes = ['/analytics', '/automations', '/people', '/revenue', '/site-review', '/telecom', '/release'];
    for (const route of routes) {
      expect(registry, route).toContain(`route: '${route}'`);
      expect(resolver, route).toContain(`pathname === '${route}'`);
    }

    for (const component of [
      'AutomationsIntegrationHub',
      'RevenueIntegrationHub',
      'SiteReviewIntegrationHub',
      'TelecomIntegrationHub',
      'ReleaseControlIntegrationHub'
    ]) {
      expect(hubs).toContain(`export function ${component}`);
      expect(resolver).toContain(`<RequireAtlasIdentity><${component} /></RequireAtlasIdentity>`);
    }
    expect(resolver).toContain('<RequireAtlasIdentity><PeopleRoutes /></RequireAtlasIdentity>');
    expect(resolver).toContain('<RequireAtlasIdentity><AnalyticsRoutes /></RequireAtlasIdentity>');
    expect(analytics).toContain('export function AnalyticsRoutes');
  });

  it('registers modern Accounting and Insurance truthfully', () => {
    expect(registry).toContain("id: 'accounting'");
    expect(registry).toContain("route: '/finance/accounting'");
    expect(registry).toContain("id: 'insurance'");
    expect(registry).toContain("route: '/insurance'");
    const insuranceStart = registry.indexOf("id: 'insurance'");
    const insuranceEnd = registry.indexOf('\n  {', insuranceStart + 1);
    expect(registry.slice(insuranceStart, insuranceEnd)).toContain("readiness: 'external-gated'");
  });

  it('reconciles business commercial depth without bypassing governance', () => {
    expect(registry).toContain("id: 'analytics'");
    expect(registry).toContain("route: '/analytics'");
    expect(app).toContain('<Route path="/business/growth/social-publisher" element={<RequireAtlasIdentity><SocialPublisherPage /></RequireAtlasIdentity>} />');
    expect(experiences).toContain("title: 'Revenue Operations'");
    expect(experiences).toContain("to: '/revenue'");
    expect(experiences).toContain("to: '/commerce'");
    expect(experiences).toContain("to: '/business/insights'");
    expect(resolver).toContain("pathname === '/business/insights'");
    expect(experiences).toContain('aggregation gated');
  });

  it('keeps migrated domains fail-closed instead of claiming provider completion', () => {
    expect(hubs).toContain('Migration gate');
    expect(hubs).toContain('External gate');
    expect(hubs).toContain('remain fail-closed');
    expect(suite).toContain('External providers');
    expect(suite).toContain("implemented: 'Integrated'");
    expect(suite).toContain('Pending external gate');
    expect(suite).toContain('machine-verifiable gate evidence can yield Production Verified');
  });
});
