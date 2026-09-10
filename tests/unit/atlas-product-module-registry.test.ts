import { describe, expect, it } from 'vitest';
import { findAtlasModule } from '../../apps/web/src/app/modules/moduleCatalog';

const expectedOrganizationCodes: Record<string, readonly string[]> = {
  'pay-wallet': ['atlas-pay'],
  education: ['education'],
  analytics: ['analytics'],
  connect: ['connect'],
  documents: ['documents'],
  knowledge: ['knowledge'],
  security: ['security'],
  studio: ['creator-studio'],
  global: ['global'],
};

describe('ATLAS product modules are backed by governed organization module codes', () => {
  it('does not leave product launchers permanently detached from backend module state', () => {
    for (const [moduleId, expectedCodes] of Object.entries(expectedOrganizationCodes)) {
      expect(findAtlasModule(moduleId)?.moduleCodes).toEqual(expectedCodes);
    }
  });
});
