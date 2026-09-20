
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('ATLAS Tax navigation contract', () => {
  const registry = readFileSync(process.cwd() + '/apps/web/src/modules/registry.ts', 'utf8');
  const app = readFileSync(process.cwd() + '/apps/web/src/App.tsx', 'utf8');
  const routes = readFileSync(process.cwd() + '/apps/web/src/modules/tax/TaxRoutes.tsx', 'utf8');

  it('registers Tax as an authenticated top-level module', () => {
    expect(registry).toContain("id: 'tax'");
    expect(registry).toContain("route: '/tax'");
    expect(registry).toContain("navLabel: 'Tax'");
  });

  it('mounts the Tax route tree in the shared shell', () => {
    expect(app).toContain("import { TaxRoutes } from './modules/tax/TaxRoutes'");
    expect(app).toContain('<Route path="/tax/*" element={<TaxRoutes />} />');
  });

  it('links W-2 intake, forms, personal, business and review workspaces', () => {
    for (const path of ['/tax/documents/w2', '/tax/forms', '/tax/personal', '/tax/business', '/tax/review']) {
      expect(routes).toContain(path);
    }
  });
});
