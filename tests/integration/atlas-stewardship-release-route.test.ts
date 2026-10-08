import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => (existsSync(path) ? readFileSync(path, 'utf8') : '');

describe('ATLAS Stewardship release blueprint integration', () => {
  it('mounts /release/stewardship behind ATLAS identity and links it from Release Control', () => {
    const resolver = read('apps/web/src/extensions/resolveAtlasExtension.tsx');
    const hubs = read('apps/web/src/modules/integration/AtlasIntegrationHubs.tsx');

    expect(resolver).toContain("pathname === '/release/stewardship'");
    expect(resolver).toContain('<RequireAtlasIdentity><AtlasStewardshipReleasePage /></RequireAtlasIdentity>');
    expect(hubs).toContain("to: '/release/stewardship'");
  });

  it('rebuilds the approved blueprint as responsive product UI with truthful release evidence', () => {
    const page = read('apps/web/src/modules/release/AtlasStewardshipReleasePage.tsx');
    const css = read('apps/web/src/modules/release/stewardship-release.css');
    const main = read('apps/web/src/main.tsx');

    expect(page).toContain('ATLAS Stewardship Governance');
    expect(page).toContain('Wave 1 — Merged • Deployed • Production Verified');
    expect(page).toContain('07ec921444137b656cffbe3123f42dd0d9b59aaf');
    expect(page).toContain('/api/v1/health = healthy');
    expect(page).toContain('HSTS + CSP');
    expect(page).toContain('Failure count');
    expect(page).toContain('Purpose');
    expect(page).toContain('Trust / Assurance');
    expect(page).toContain('Legacy');
    expect(page).toContain('Historical production evidence');
    expect(page).not.toContain('<img');

    expect(css).toContain('@media');
    expect(css).toContain('.stewardship-release-page');
    expect(main).toContain("./modules/release/stewardship-release.css");
  });
});
