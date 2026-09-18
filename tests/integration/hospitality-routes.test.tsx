import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const moduleRoot = resolve(root, 'apps/web/src/modules/hospitality');
const routePath = resolve(moduleRoot, 'HospitalityRoutes.tsx');
const apiPath = resolve(root, 'apps/web/src/lib/hospitalityApi.ts');
const moduleRegistryPath = resolve(root, 'apps/web/src/modules/registry.ts');
const pages = [
  'ProvidersPage.tsx',
  'RoomsPage.tsx',
  'CredentialsPage.tsx',
  'AuditPage.tsx'
].map((file) => resolve(moduleRoot, file));

describe('ATLAS Hospitality route and UI contract', () => {
  it('creates the authenticated Hospitality API client and all workspace pages', () => {
    expect(existsSync(apiPath)).toBe(true);
    for (const page of pages) expect(existsSync(page)).toBe(true);
  });

  it('uses the Hospitality OS overview as the governed module home', () => {
    const source = readFileSync(routePath, 'utf8');
    const registry = readFileSync(moduleRegistryPath, 'utf8');
    expect(source).toContain('HospitalityOverviewPage');
    expect(source).toContain('<Route path="/hospitality" element={<Navigate to="/hospitality/overview" replace />} />');
    expect(source).toContain('<Route path="/hospitality/overview" element={<HospitalityOverviewPage />} />');
    expect(source).toContain('<Route path="/hospitality/properties" element={<PropertiesPage />} />');
    expect(registry).toContain("route: '/hospitality'");
    expect(registry).toContain("navLabel: 'Hospitality'");
    expect(registry).toContain('showInNavigation: true');
  });

  it('exposes all protected Hospitality access routes', () => {
    const source = readFileSync(routePath, 'utf8');
    for (const route of [
      '/hospitality/access',
      '/hospitality/access/providers',
      '/hospitality/access/rooms',
      '/hospitality/access/credentials',
      '/hospitality/access/audit'
    ]) {
      expect(source).toContain(`path="${route}"`);
    }
    expect(source).toContain('RequireAtlasIdentity');
  });

  it('uses truthful readiness labels rather than generic connected claims', () => {
    expect(existsSync(pages[0])).toBe(true);
    const source = readFileSync(pages[0], 'utf8');
    for (const label of [
      'Not configured',
      'Configured — verification required',
      'Ready',
      'Degraded',
      'Offline',
      'Disabled'
    ]) {
      expect(source).toContain(label);
    }
  });

  it('gates issuance and never asks browser users for lock secrets', () => {
    expect(existsSync(pages[2])).toBe(true);
    const source = readFileSync(pages[2], 'utf8').toLowerCase();
    expect(source).toContain('canissue');
    expect(source).toContain('disabled={!canissue');
    expect(source).not.toMatch(/<label[^>]*>[^<]*(token|secret|master key|private key|encoder secret)/i);
  });

  it('retains responsive tablet/mobile boundaries', () => {
    const css = readFileSync(resolve(moduleRoot, 'hospitality.css'), 'utf8');
    expect(css).toContain('@media (max-width: 900px)');
    expect(css).toContain('@media (max-width: 640px)');
  });
});
