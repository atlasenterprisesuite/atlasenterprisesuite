import { describe, expect, it } from 'vitest';
import { implementedNavigationItems } from '../../apps/web/src/navigation/atlasNavigation';

describe('ATLAS implemented route contract', () => {
  it('requires every implemented destination to resolve to an absolute route', () => {
    expect(implementedNavigationItems().every((item) => typeof item.route === 'string' && item.route.startsWith('/'))).toBe(true);
  });
});
