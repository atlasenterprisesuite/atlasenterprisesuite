import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Hospitality OS route contract', () => {
  it('adds OS routes and preserves room-access routes', () => {
    const routes = readFileSync(resolve(process.cwd(), 'apps/web/src/modules/hospitality/HospitalityRoutes.tsx'), 'utf8');
    expect(routes).toContain('/hospitality/overview');
    expect(routes).toContain('/hospitality/properties');
    expect(routes).toContain('/hospitality/access');
    expect(routes).toContain('/hospitality/access/providers');
    expect(routes).toContain('/hospitality/access/rooms');
    expect(routes).toContain('/hospitality/access/credentials');
    expect(routes).toContain('/hospitality/access/audit');
  });

  it('uses the OS overview as the Hospitality landing and fallback', () => {
    const routes = readFileSync(resolve(process.cwd(), 'apps/web/src/modules/hospitality/HospitalityRoutes.tsx'), 'utf8');
    expect(routes.match(/to="\/hospitality\/overview"/g)?.length).toBeGreaterThanOrEqual(2);
  });
});
