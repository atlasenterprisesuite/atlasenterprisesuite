import { describe, expect, it } from 'vitest';
import { atlasNavigation } from '../../apps/web/src/navigation/atlasNavigation';

describe('ATLAS shell command navigation', () => {
  it('keeps implemented and catalog destinations explicit', () => {
    const implemented = atlasNavigation.filter((item) => item.availability === 'implemented');
    const catalog = atlasNavigation.filter((item) => item.availability === 'catalog');
    expect(implemented.every((item) => Boolean(item.route))).toBe(true);
    expect(catalog.every((item) => item.route === undefined)).toBe(true);
  });

  it('contains the native command surfaces', () => {
    expect(atlasNavigation.some((item) => item.route === '/blueprints')).toBe(true);
    expect(atlasNavigation.some((item) => item.route === '/orchestrator')).toBe(true);
  });
});
