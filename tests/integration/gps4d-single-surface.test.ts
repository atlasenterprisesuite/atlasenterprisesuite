import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const page = readFileSync('apps/web/src/modules/gps/Gps4DPage.tsx', 'utf8');
const styles = readFileSync('apps/web/src/modules/gps/gps4d.css', 'utf8');

describe('GPS 4D single-surface navigation regression', () => {
  it('offers two accessible navigation views without resetting the route', () => {
    expect(page).toContain("useState<'drive3d' | 'map2d'>('drive3d')");
    expect(page).toContain('aria-label="Vista de navegación"');
    expect(page).toContain("setNavigationSurface('drive3d')");
    expect(page).toContain("setNavigationSurface('map2d')");
    expect(page).toContain("gps4d-single-view-${navigationSurface}");
    expect(page).toContain("const [navigationActive, setNavigationActive]");
  });

  it('hides the inactive map and gives the active map full viewport height', () => {
    expect(styles).toContain('.gps4d-map-wrap-navigation.gps4d-single-view');
    expect(styles).toContain('.gps4d-single-view-drive3d .gps4d-overview-map');
    expect(styles).toContain('.gps4d-single-view-map2d .gps4d-drive-view');
    expect(styles).toContain('visibility:hidden');
    expect(styles).toContain('height:100svh');
  });
});
