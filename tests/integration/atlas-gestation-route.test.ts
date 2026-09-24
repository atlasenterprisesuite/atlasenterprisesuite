import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => (existsSync(path) ? readFileSync(path, 'utf8') : '');

describe('ATLAS Gestation release-control integration', () => {
  it('exposes the gestation control behind ATLAS identity', () => {
    const resolver = read('apps/web/src/extensions/resolveAtlasExtension.tsx');
    const hubs = read('apps/web/src/modules/integration/AtlasIntegrationHubs.tsx');
    const page = read('apps/web/src/modules/release/AtlasGestationPage.tsx');

    expect(resolver).toContain("pathname === '/release/gestation'");
    expect(resolver).toContain('<RequireAtlasIdentity><AtlasGestationPage /></RequireAtlasIdentity>');
    expect(hubs).toContain("to: '/release/gestation'");
    expect(page).toContain('From conception to birth');
    expect(page).toContain('No percentage is inferred from code volume');
  });
});
