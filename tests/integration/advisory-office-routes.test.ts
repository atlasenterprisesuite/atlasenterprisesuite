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

  it('routes Advisory through the canonical identity gate', () => {
    const resolver = readFileSync(resolve(root, 'apps/web/src/extensions/resolveAtlasExtension.tsx'), 'utf8');
    expect(resolver).toContain("pathname === '/advisory'");
    expect(resolver).toContain('<RequireAtlasIdentity><AdvisoryOfficePage /></RequireAtlasIdentity>');
  });

  it('keeps persistence and provider execution truthfully gated in the UI', () => {
    const page = readFileSync(resolve(root, 'apps/web/src/modules/advisory/AdvisoryOfficePage.tsx'), 'utf8');
    expect(page).toContain('No client, revenue, invoice or readiness metric is fabricated');
    expect(page).toContain('Provider authorization required');
  });
});
