import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Hospitality OS UI boundaries', () => {
  it('does not expose unimplemented PMS/POS actions as live controls', () => {
    const overview = readFileSync(resolve(process.cwd(), 'apps/web/src/modules/hospitality/HospitalityOverviewPage.tsx'), 'utf8');
    expect(overview).not.toContain('Create reservation');
    expect(overview).not.toContain('Open POS');
    expect(overview).toContain('Hotel Operations');
    expect(overview).toContain('Restaurant Operations');
    expect(overview).toContain('Room Access');
  });

  it('keeps properties truthful when no verified property backend exists', () => {
    const properties = readFileSync(resolve(process.cwd(), 'apps/web/src/modules/hospitality/PropertiesPage.tsx'), 'utf8');
    expect(properties).toContain('No verified property catalog is connected');
    expect(properties).not.toContain('Create Property');
  });
});
