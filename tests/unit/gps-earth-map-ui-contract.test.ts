import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const page = readFileSync('apps/web/src/modules/gps/Gps4DPage.tsx', 'utf8');
const css = readFileSync('apps/web/src/modules/gps/gps4d.css', 'utf8');

describe('ATLAS Earth GPS 4D outbound provider link contracts', () => {
  it('derives URLs only from the selected and validated point', () => {
    expect(page).toContain('selected ? earthMapLinks(selected) : null');
    expect(page).toContain('{externalMapLinks && (');
  });

  it('links to external providers without injected scripts or auto-opening', () => {
    expect(page).toContain('href={externalMapLinks.googleMaps}');
    expect(page).toContain('href={externalMapLinks.appleMaps}');
    expect(page).toContain('target="_blank" rel="noopener noreferrer"');
    expect(page).not.toContain('window.open(externalMapLinks');
  });

  it('provides navigation semantics and visible keyboard focus', () => {
    expect(page).toContain('aria-label="Abrir punto seleccionado en mapas externos"');
    expect(page).toContain('aria-label="Abrir punto seleccionado en Google Maps (servicio externo)"');
    expect(page).toContain('aria-label="Abrir punto seleccionado en Apple Maps (servicio externo)"');
    expect(css).toContain('.gps4d-actions a:focus-visible');
    expect(css).toContain('min-height:44px');
  });
});
