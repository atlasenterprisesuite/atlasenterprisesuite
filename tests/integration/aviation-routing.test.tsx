import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const registryPath = 'apps/web/src/modules/registry.ts';
const resolverPath = 'apps/web/src/extensions/resolveAtlasExtension.tsx';
const routesPath = 'apps/web/src/modules/aviation/AviationRoutes.tsx';

const registry = readFileSync(registryPath, 'utf8');
const resolver = readFileSync(resolverPath, 'utf8');

describe('ATLAS Aviation canonical routing', () => {
  it('registers Aviation once as an authenticated Mobility module', () => {
    expect(registry).toContain("id: 'aviation'");
    expect(registry).toContain("title: 'ATLAS Aviation'");
    expect(registry).toContain("navLabel: 'Aviation'");
    expect(registry).toContain("area: 'Mobility'");
    expect(registry).toContain("route: '/mobility/aviation'");
    expect(registry).toContain('requiresAuth: true');
    expect(registry).toContain('showInNavigation: true');
    expect((registry.match(/id: 'aviation'/g) || []).length).toBe(1);
  });

  it('routes the full Aviation family through the existing identity boundary', () => {
    expect(existsSync(routesPath)).toBe(true);
    expect(resolver).toContain("import { AviationRoutes } from '../modules/aviation/AviationRoutes';");
    expect(resolver).toContain("pathname === '/mobility/aviation'");
    expect(resolver).toContain("pathname.startsWith('/mobility/aviation/')");
    expect(resolver).toContain('<RequireAtlasIdentity><AviationRoutes /></RequireAtlasIdentity>');
  });
});
