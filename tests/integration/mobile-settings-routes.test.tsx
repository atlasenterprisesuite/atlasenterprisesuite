import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { getAtlasNavigationTrail } from '../../apps/web/src/navigation/atlasNavigation';
import { MOBILE_SETTINGS_SECTIONS } from '../../apps/web/src/modules/settings/MobileSettingsRoutes';

const routesSource = readFileSync('apps/web/src/modules/settings/MobileSettingsRoutes.tsx', 'utf8');
const resolverSource = readFileSync('apps/web/src/extensions/resolveAtlasExtension.tsx', 'utf8');
const navigationSource = readFileSync('apps/web/src/navigation/atlasNavigation.ts', 'utf8');

const expectedRoutes = [
  '/settings/account',
  '/settings/preferences',
  '/settings/privacy',
  '/settings/security',
  '/settings/billing',
  '/settings/diagnostics',
  '/settings/about'
];

describe('ATLAS consolidated mobile settings routes', () => {
  it('exposes every approved settings route exactly once', () => {
    expect(MOBILE_SETTINGS_SECTIONS.map((section) => section.to)).toEqual(expectedRoutes);
    expect(new Set(MOBILE_SETTINGS_SECTIONS.map((section) => section.to)).size).toBe(expectedRoutes.length);
  });

  it('keeps the settings family behind the canonical identity guard', () => {
    expect(resolverSource).toContain("pathname === '/settings'");
    expect(resolverSource).toContain("pathname.startsWith('/settings/')");
    expect(resolverSource).toContain('<RequireAtlasIdentity><MobileSettingsRoutes /></RequireAtlasIdentity>');
  });

  it('uses explicit unavailable placeholders and a not-found state rather than fake success', () => {
    expect(routesSource).toContain('Unavailable');
    expect(routesSource).toContain('Settings route not found');
    expect(routesSource).toContain('path="*"');
    expect(routesSource).not.toContain('path="*" element={<Navigate');
  });

  it('adds searchable settings destinations to the canonical navigation graph', () => {
    for (const route of expectedRoutes) expect(navigationSource).toContain(`to: '${route}'`);
    expect(navigationSource).toContain("label: 'Settings'");
  });

  it('keeps Settings as the parent of Account instead of shadowing its route', () => {
    expect(getAtlasNavigationTrail('/settings/account').map((node) => node.label)).toEqual([
      'Home',
      'Settings',
      'Account'
    ]);
  });
});
