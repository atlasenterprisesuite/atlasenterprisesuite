import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();

describe('Advisory Office canonical integration', () => {
  it('registers Advisory as an authenticated ATLAS module', () => {
    const registry = readFileSync(resolve(root, 'apps/web/src/modules/registry.ts'), 'utf8');
    expect(registry).toContain("id: 'advisory'");
    expect(registry).toContain("route: '/advisory'");
    expect(registry).toMatch(/id: 'advisory'[\s\S]*requiresAuth: true/);
  });

  it('routes Advisory and all subpaths through the canonical identity gate', () => {
    const resolver = readFileSync(resolve(root, 'apps/web/src/extensions/resolveAtlasExtension.tsx'), 'utf8');
    expect(resolver).toContain("pathname === '/advisory'");
    expect(resolver).toContain("pathname.startsWith('/advisory/')");
    expect(resolver).toContain('<RequireAtlasIdentity><AdvisoryRoutes /></RequireAtlasIdentity>');
  });

  it('reuses canonical ATLAS Work for Advisory tasks instead of a placeholder ledger', () => {
    const page = readFileSync(resolve(root, 'apps/web/src/modules/advisory/AdvisoryRoutes.tsx'), 'utf8');
    expect(page).toContain("import { listWorkflows } from '../../work/api'");
    expect(page).toContain("import { WorkQueue } from '../../work/WorkQueue'");
    expect(page).toContain('<Route path="/advisory/tasks" element={<AdvisoryTasksPage />} />');
    expect(page).toContain('Create work');
    expect(page).toContain('Open Work Command Center');
    expect(page).not.toContain('Task orchestration will reuse the canonical ATLAS execution/work layer');
  });

  it('keeps the Advisory tab bar usable on narrow mobile screens', () => {
    const css = readFileSync(resolve(root, 'apps/web/src/modules/advisory/advisory.css'), 'utf8');
    expect(css).toContain('overflow-x:auto');
    expect(css).toContain('-webkit-overflow-scrolling:touch');
    expect(css).toContain('flex:0 0 auto');
    expect(css).toContain('.advisory-nav a.active');
  });

  it('keeps persistence and provider execution truthfully gated in the UI', () => {
    const page = readFileSync(resolve(root, 'apps/web/src/modules/advisory/AdvisoryRoutes.tsx'), 'utf8');
    expect(page).toMatch(/No demo clients are seeded|No clients yet/);
    expect(page).toContain('Authorization required');
    expect(page).toMatch(/not connected until real provider authorization is verified/i);
  });
});
