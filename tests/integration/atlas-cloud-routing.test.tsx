import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const registry = readFileSync('apps/web/src/modules/registry.ts', 'utf8');
const resolver = readFileSync('apps/web/src/extensions/resolveAtlasExtension.tsx', 'utf8');
const routes = readFileSync('apps/web/src/modules/cloud/AtlasCloudRoutes.tsx', 'utf8');
const nextLevel = readFileSync('apps/web/src/modules/cloud/AtlasCloudNextLevel.tsx', 'utf8');
const main = readFileSync('apps/web/src/main.tsx', 'utf8');
const backend = readFileSync('supabase/functions/atlas-observability/index.ts', 'utf8');

describe('ATLAS Cloud routing and product boundaries', () => {
  it('registers Atlas Cloud as a first-class module', () => {
    expect(registry).toContain("id: 'cloud'");
    expect(registry).toContain("route: '/cloud'");
    expect(registry).toContain("navLabel: 'Cloud'");
  });

  it('keeps documentation public and the administrative console identity-gated', () => {
    expect(resolver).toContain("pathname === '/cloud/docs'");
    expect(resolver).toContain("pathname.startsWith('/cloud/docs/')");
    expect(resolver).toContain('<AtlasCloudRoutes />');
    expect(resolver).toContain('<RequireAtlasIdentity><AtlasCloudRoutes /></RequireAtlasIdentity>');
  });

  it('builds the catalog from the canonical module registry', () => {
    expect(routes).toContain("ATLAS_MODULES");
    expect(routes).toContain("Search services");
    expect(routes).toContain("Service catalog");
    expect(routes).toContain("Manager Readiness");
    expect(routes).toContain("Release Control");
    expect(routes).toContain("ATLAS Automations");
  });

  it('routes the next-level control surfaces behind Atlas identity', () => {
    for (const route of ['/cloud/api-explorer', '/cloud/observability', '/cloud/resources']) {
      expect(routes).toContain(route);
    }
    expect(nextLevel).toContain('ATLAS Cloud · Developer Control');
    expect(nextLevel).toContain('ATLAS Cloud · Native Telemetry');
    expect(nextLevel).toContain('ATLAS Cloud · Resource Hierarchy');
    expect(nextLevel).toContain('atlas-observability');
    expect(nextLevel).not.toContain('atlas-cloud-control');
  });

  it('reuses the existing observability runtime for organization-scoped Cloud control APIs', () => {
    expect(backend).toContain("api==='cloud-openapi'");
    expect(backend).toContain("api==='cloud-resources'");
    expect(backend).toContain("api==='cloud-project'");
    expect(backend).toContain("api==='cloud-project-create'");
    expect(backend).toContain("api==='cloud-observability'");
    expect(backend).toContain("requirePermission(ctx,'projects.read')");
    expect(backend).toContain("requirePermission(ctx,'projects.write')");
    expect(backend).toContain("org_id=eq.");
    expect(backend).toContain("duplicated_registry_created:false");
  });

  it('loads Atlas Cloud styles from the primary web entry point', () => {
    expect(main).toContain("./modules/cloud/cloud.css");
  });
});
