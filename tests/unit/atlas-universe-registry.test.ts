import { describe, expect, it } from 'vitest';
import { atlasUniverseModules, getUniverseModule } from '../../apps/web/src/universe/moduleRegistry';

const requiredIds = [
  'atlas-os',
  'finance',
  'accounting',
  'payroll',
  'hr',
  'health',
  'ride',
  'crm',
  'sales',
  'inventory',
  'purchasing',
  'accounts-payable',
  'accounts-receivable',
  'tax',
  'pos',
  'projects',
  'analytics',
  'insurance',
  'telecom',
  'creator-studio',
  'learning',
  'security',
  'atlas-pay',
  'cleanscan-3d',
  'atlas-drive',
  'atlas-voice',
  'atlas-connect',
  'gps-4d',
  'hospitality',
  'venezuela'
] as const;

describe('ATLAS Universe registry', () => {
  it('contains every approved universe module exactly once', () => {
    const ids = atlasUniverseModules.map((module) => module.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(expect.arrayContaining([...requiredIds]));
  });

  it('marks only verified canonical routes active', () => {
    expect(getUniverseModule('finance')?.route).toBe('/finance');
    expect(getUniverseModule('finance')?.status).toBe('active');

    expect(getUniverseModule('payroll')?.route).toBe('/payroll');
    expect(getUniverseModule('payroll')?.status).toBe('active');

    expect(getUniverseModule('health')?.route).toBe('/health');
    expect(getUniverseModule('health')?.status).toBe('active');

    expect(getUniverseModule('creator-studio')?.route).toBe('/studio');
    expect(getUniverseModule('creator-studio')?.status).toBe('active');

    expect(getUniverseModule('hospitality')?.route).toBe('/hospitality/access');
    expect(getUniverseModule('hospitality')?.status).toBe('active');

    expect(getUniverseModule('crm')?.status).not.toBe('active');
  });

  it('keeps authorization outside navigation metadata', () => {
    expect(atlasUniverseModules.every((module) => Array.isArray(module.requiredPermissions))).toBe(true);
    expect(
      atlasUniverseModules.some((module) => Object.prototype.hasOwnProperty.call(module, 'authorized'))
    ).toBe(false);
  });
});
