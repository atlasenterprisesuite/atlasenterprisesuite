import { describe, expect, it } from 'vitest';
import { atlasNavigation } from '../../apps/web/src/navigation/atlasNavigation';

describe('ATLAS shell navigation safety', () => {
  it('never assigns a route to catalog-only navigation entries', () => {
    expect(atlasNavigation.filter((item) => item.availability === 'catalog').every((item) => item.route === undefined)).toBe(true);
  });
});
