import { describe, expect, it } from 'vitest';
import { getAtlasNavigationNode, searchAtlasNavigation } from '../../apps/web/src/navigation/atlasNavigation';

describe('ATLAS Recruiting discovery keeps the identity boundary', () => {
  it('finds Recruiting in Spanish and English through canonical navigation search', () => {
    expect(searchAtlasNavigation('reclutamiento')[0]?.to).toBe('/people/recruiting');
    expect(searchAtlasNavigation('recruiter safety')[0]?.to).toBe('/people/recruiting');
  });

  it('links the Recruiting surface to the existing People module, not a duplicate module', () => {
    const route = getAtlasNavigationNode('/people/recruiting');
    expect(route?.moduleId).toBe('people');
    expect(route?.parentId).toBe('people');
  });
});
