import { describe, expect, it } from 'vitest';
import { atlasNavigation, implementedNavigationItems } from '../../apps/web/src/navigation/atlasNavigation';

describe('ATLAS governed navigation', () => {
  it('keeps canonical navigation labels unique', () => {
    const labels = atlasNavigation.map((item) => item.label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('requires implemented items to have absolute routes', () => {
    const implemented = implementedNavigationItems();
    expect(implemented.length).toBeGreaterThan(0);
    expect(implemented.every((item) => item.route?.startsWith('/'))).toBe(true);
  });

  it('exposes Blueprints and Orchestrator as implemented destinations', () => {
    expect(atlasNavigation).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'blueprints', route: '/blueprints', availability: 'implemented' }),
      expect.objectContaining({ id: 'orchestrator', route: '/orchestrator', availability: 'implemented' })
    ]));
  });

  it('does not give catalog-only items fake routes', () => {
    const catalogOnly = atlasNavigation.filter((item) => item.availability === 'catalog');
    expect(catalogOnly.every((item) => item.route === undefined)).toBe(true);
  });
});
