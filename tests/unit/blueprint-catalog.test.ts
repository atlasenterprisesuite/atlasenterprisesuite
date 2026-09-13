import { describe, expect, it } from 'vitest';
import { blueprintCatalog } from '../../apps/web/src/modules/blueprints/blueprintCatalog';

describe('ATLAS blueprint catalog', () => {
  it('reuses the approved canonical Library references', () => {
    const titles = blueprintCatalog.map((item) => item.title);
    expect(titles).toEqual(expect.arrayContaining([
      'ATLAS Universe Enterprise Dashboard',
      'ATLAS Enterprise Suite Master',
      'ATLAS One Identity',
      'ATLAS Payroll: A Brighter Tomorrow',
      'ATLAS CRM: One Connected Pipeline',
      'Atlas Inventory Command Center',
      'Venezuela ATLAS: A Futuristic Command Center'
    ]));
    expect(blueprintCatalog.every((item) => item.provenance === 'library')).toBe(true);
  });

  it('does not invent routes for catalog-only modules', () => {
    expect(blueprintCatalog.filter((item) => item.implementationStatus === 'catalog').every((item) => item.moduleRoute === undefined)).toBe(true);
  });
});
