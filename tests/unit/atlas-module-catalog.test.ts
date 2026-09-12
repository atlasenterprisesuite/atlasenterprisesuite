import { describe, expect, it } from 'vitest';
import { ATLAS_MODULE_CATALOG } from '../../apps/web/src/app/modules/moduleCatalog';

const approvedNames = [
  'ATLAS HR',
  'ATLAS Payroll',
  'ATLAS Finance',
  'ATLAS ERP',
  'ATLAS Pay & Wallet',
  'ATLAS Health',
  'ATLAS Education',
  'ATLAS Analytics',
  'ATLAS Connect',
  'ATLAS Documents',
  'Knowledge Atlas',
  'ATLAS Security',
  'ATLAS Identity',
  'ATLAS Projects',
  'ATLAS Studio',
  'ATLAS Workbench',
  'ATLAS RideOS',
  'ATLAS Global',
] as const;

describe('ATLAS product module catalog', () => {
  it('contains exactly the 18 approved unique product modules in visual order', () => {
    expect(ATLAS_MODULE_CATALOG).toHaveLength(18);
    expect(ATLAS_MODULE_CATALOG.map((module) => module.displayName)).toEqual(approvedNames);
    expect(new Set(ATLAS_MODULE_CATALOG.map((module) => module.id)).size).toBe(18);
    expect(new Set(ATLAS_MODULE_CATALOG.map((module) => module.route)).size).toBe(18);
  });

  it('uses canonical authenticated app routes', () => {
    for (const module of ATLAS_MODULE_CATALOG) {
      expect(module.route.startsWith('/app/')).toBe(true);
    }
  });
});
