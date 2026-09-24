import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const page = readFileSync('apps/web/src/modules/gps/Gps4DPage.tsx', 'utf8');
const css = readFileSync('apps/web/src/modules/gps/gps4d.css', 'utf8');

describe('ATLAS GPS 4D drive navigation UI', () => {
  it('renders a synchronized drive view above the route overview during active navigation', () => {
    expect(page).toContain('driveMapNode');
    expect(page).toContain('driveMap.current');
    expect(page).toContain("pitch: 72");
    expect(page).toContain("zoom: 18.2");
    expect(page).toContain('gps4d-drive-view');
    expect(page).toContain('gps4d-overview-map');
    expect(css).toContain('grid-template-rows:minmax(340px,48vh) minmax(360px,52vh)');
  });

  it('renders route geometry independently on overview and drive maps', () => {
    expect(page).toContain("renderRouteOn(map.current, route, 'atlas-overview-route', true)");
    expect(page).toContain("renderRouteOn(driveMap.current, route, 'atlas-drive-route', false)");
    expect(page).toContain("'line-color': '#35c8ff'");
    expect(page).toContain("'line-color': '#6f4cff'");
  });

  it('follows GPS heading in drive view while keeping overview readable', () => {
    expect(page).toContain('driveMap.current.easeTo');
    expect(page).toContain('bearing: next.heading_deg');
    expect(page).toContain('pitch: 72');
    expect(page).toContain("bearing: navigationActiveRef.current ? 0");
    expect(page).toContain("pitch: navigationActiveRef.current ? 0");
  });

  it('shows maneuver, distance, lane evidence, ETA and an explicit End action', () => {
    expect(page).toContain('maneuverSymbol(activeStep)');
    expect(page).toContain('instructionLabel(activeStep)');
    expect(page).toContain('laneLabel(activeStep)');
    expect(page).toContain('gps4d-turn-card');
    expect(page).toContain('× End');
    expect(css).toContain('.gps4d-turn-card');
  });

  it('keeps proprietary street-level imagery fail closed', () => {
    expect(page).toContain('Street-level imagery requiere un proveedor autorizado');
    expect(page).toContain('Street-level imagery BLOCKED');
    expect(page).not.toContain('google.maps');
    expect(page).not.toContain('MapKit');
  });

  it('switches to a full navigation-first mobile layout', () => {
    expect(page).toContain("navigationActive ? 'gps4d-nav-hidden'");
    expect(page).toContain('gps4d-panel-navigation-hidden');
    expect(css).toContain('grid-template-rows:42svh 58svh');
    expect(css).toContain('.gps4d-panel-navigation-hidden { display:none; }');
  });
});
