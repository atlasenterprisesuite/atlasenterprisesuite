import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const worker = readFileSync('worker/index.ts', 'utf8');
const page = readFileSync('apps/web/src/modules/gps/Gps4DPage.tsx', 'utf8');

describe('ATLAS GPS browser security boundary', () => {
  it('allows first-party geolocation while retaining sensitive browser denials', () => {
    expect(worker).toContain('geolocation=(self)');
    expect(worker).toContain('camera=()');
    expect(worker).toContain('payment=()');
    expect(worker).toContain('usb=()');
    expect(worker).toContain('xr-spatial-tracking=(self)');
  });

  it('uses a pinned MapLibre release and a narrow CSP allowlist instead of wildcard script execution', () => {
    expect(page).toContain('maplibre-gl@6.11.1');
    expect(worker).toContain("script-src 'self' https://unpkg.com");
    expect(worker).not.toContain("script-src 'self' https:");
    expect(worker).toContain('https://tiles.openfreemap.org');
    expect(worker).toContain('https://basemap.nationalmap.gov');
    expect(worker).toContain('https://tiles.mapterhorn.com');
    expect(worker).toContain("worker-src 'self' blob:");
  });
});
