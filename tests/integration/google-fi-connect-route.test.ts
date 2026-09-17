import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const registryPath = 'apps/web/src/modules/registry.ts';
const resolverPath = 'apps/web/src/extensions/resolveAtlasExtension.tsx';
const pagePath = 'apps/web/src/modules/connect/GoogleFiWirelessPage.tsx';

const read = (path: string) => existsSync(path) ? readFileSync(path, 'utf8') : '';

describe('ATLAS Connect · Google Fi Wireless', () => {
  it('registers ATLAS Connect as an authenticated external-gated module', () => {
    const source = read(registryPath);
    expect(source).toContain("id: 'connect'");
    expect(source).toContain("route: '/connect'");
    expect(source).toContain("readiness: 'external-gated'");
    expect(source).toContain('requiresAuth: true');
  });

  it('routes Connect through the canonical extension resolver and identity guard', () => {
    const source = read(resolverPath);
    expect(source).toContain("pathname === '/connect'");
    expect(source).toContain("pathname.startsWith('/connect/')");
    expect(source).toContain('<ConnectRoutes />');
    expect(source).toContain('<RequireAtlasIdentity>');
  });

  it('keeps Google Fi provider capabilities truthful and external-gated', () => {
    expect(existsSync(pagePath)).toBe(true);
    const source = read(pagePath);
    expect(source).toContain('Google Fi Wireless');
    expect(source).toContain('https://fi.google.com/account');
    expect(source).toContain('No public Google Fi customer account API');
    expect(source).toContain('.csv,.json,.pdf');
    expect(source).not.toContain('99.99%');
    expect(source).not.toContain('live usage');
  });
});
