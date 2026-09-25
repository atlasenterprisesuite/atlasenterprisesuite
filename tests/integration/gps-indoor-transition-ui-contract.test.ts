import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const page = readFileSync('apps/web/src/modules/gps/Gps4DPage.tsx', 'utf8');
const spatial = readFileSync('apps/web/src/modules/gps/immersiveSpatial.ts', 'utf8');

describe('ATLAS GPS outdoor to indoor transition UI', () => {
  it('exposes an explicit Enter Building transition instead of implying indoor coverage', () => {
    expect(spatial).toContain('IndoorBuilding');
    expect(page).toContain('IndoorNavigationPanel');
    expect(page).toContain('Entrar al edificio');
  });

  it('keeps a visible floor selector and source truth in indoor mode', () => {
    expect(page).toContain('Piso');
    expect(page).toContain('Fuente indoor');
  });
});
