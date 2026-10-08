import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const view = readFileSync('apps/web/src/modules/gps/Photorealistic3DView.tsx', 'utf8');
const page = readFileSync('apps/web/src/modules/gps/Gps4DPage.tsx', 'utf8');
const domain = readFileSync('apps/web/src/modules/gps/immersiveSpatial.ts', 'utf8');

describe('ATLAS GPS photorealistic 3D contract', () => {
  it('uses the governed Google 3D Tiles root without committing a credential', () => {
    expect(view).toContain('https://tile.googleapis.com/v1/3dtiles/root.json');
    expect(view).toContain('showCreditsOnScreen: true');
    expect(view).toContain("tile.googleapis.com:443");
    expect(view).not.toContain('YOUR_API_KEY');
  });

  it('keeps photorealistic mode external-gated and fail-closed', () => {
    expect(domain).toContain("id: 'google-photorealistic-3d'");
    expect(domain).toContain("state: 'external-gated'");
    expect(domain).toContain("reason: 'Photorealistic provider is not configured; fail-closed to ATLAS Open 3D.'");
    expect(page).toContain('VITE_ATLAS_GOOGLE_MAP_TILES_KEY');
    expect(page).toContain('Photorealistic');
  });

  it('preserves the open 3D fallback when Google is unavailable', () => {
    expect(domain).toContain("resolved: 'open-3d'");
    expect(domain).toContain("provider: 'atlas-open-3d'");
  });
});
