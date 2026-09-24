import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const page = readFileSync('apps/web/src/modules/gps/Gps4DPage.tsx', 'utf8');
const css = readFileSync('apps/web/src/modules/gps/gps4d.css', 'utf8');

describe('ATLAS GPS fused mobile experience', () => {
  it('does not treat a failed external layer as a failed map engine', () => {
    expect(page).toContain("const [engineState");
    expect(page).toContain("const [layerState");
    expect(page).toContain('Motor MapLibre no disponible');
    expect(page).toContain('La capa seleccionada no respondió');
    expect(page).toContain('Usar otra capa');
  });

  it('uses the supported OpenFreeMap liberty style and keeps satellite as an independent layer', () => {
    expect(page).toContain("https://tiles.openfreemap.org/styles/liberty");
    expect(page).toContain('USGSImageryOnly');
    expect(page).toContain("setViewMode(viewMode === 'street' ? 'satellite' : 'street')");
  });

  it('renders the map before the long navigation panel on mobile', () => {
    expect(css).toContain('.gps4d-map-wrap { order:1;');
    expect(css).toContain('.gps4d-panel { order:2;');
    expect(css).not.toContain('.gps4d-panel { order:-1; max-height:none; }');
  });

  it('supports multi-stop, route comparison, sharing and arrival cues', () => {
    expect(page).toContain('multi-stop');
    expect(page).toContain('+ Parada');
    expect(page).toContain('Más rápida');
    expect(page).toContain('Menos distancia');
    expect(page).toContain('navigator.share');
    expect(page).toContain('Llegaste a tu destino');
  });
});
