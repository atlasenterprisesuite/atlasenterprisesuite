import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const routesSource = readFileSync('apps/web/src/modules/settings/MobileSettingsRoutes.tsx', 'utf8');
const pageSource = readFileSync('apps/web/src/modules/settings/IdentityDiagnosticsPage.tsx', 'utf8');

describe('ATLAS identity diagnostics settings route', () => {
  it('replaces the security placeholder with the diagnostics page', () => {
    expect(routesSource).toContain('IdentityDiagnosticsPage');
    expect(routesSource).toContain('path="security" element={<IdentityDiagnosticsPage />}');
  });

  it('uses current mobile gateway evidence plus canonical organization context', () => {
    expect(pageSource).toContain('getMobileStatus');
    expect(pageSource).toContain('getCachedAtlasShellOrganization');
    expect(pageSource).toContain('to="/identity"');
  });

  it('never reads or renders raw credentials', () => {
    expect(pageSource).not.toContain('getAtlasAccessToken');
    expect(pageSource).not.toContain('rawToken');
    expect(pageSource).not.toContain('cookie');
    expect(pageSource).not.toContain('authorization');
    expect(pageSource).toContain('Unverified');
  });
});
