import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const page = readFileSync('apps/web/src/modules/city/AtlasDigitalDistrictPage.tsx', 'utf8');
const registry = readFileSync('apps/web/src/modules/registry.ts', 'utf8');
const app = readFileSync('apps/web/src/App.tsx', 'utf8');

describe('ATLAS Digital District Orlando pilot', () => {
  it('keeps live city state fail-closed and simulation explicit', () => {
    expect(page).toContain("type DistrictMode = 'simulation' | 'live'");
    expect(page).toContain('LIVE TELEMETRY GATED');
    expect(page).toContain('SIMULATION · no operational claim');
    expect(page).toContain('No authenticated city/device feed is bound to this surface yet.');
  });

  it('reuses canonical ATLAS spatial and operations modules', () => {
    for (const route of ['/gps', '/ride', '/connect', '/device-os', '/galaxy']) {
      expect(page).toContain(`to: '${route}'`);
    }
  });

  it('registers a protected canonical city route', () => {
    expect(registry).toContain("id: 'city'");
    expect(registry).toContain("route: '/city'");
    expect(app).toContain('path="/city"');
    expect(app).toContain('<RequireAtlasIdentity><AtlasDigitalDistrictPage /></RequireAtlasIdentity>');
  });
});
