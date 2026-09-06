import { describe, expect, it } from 'vitest';
import { healthModuleCatalog } from '../../packages/health/src';

describe('Health module catalog', () => {
  it('contains exactly the approved 18 modules', () => {
    expect(healthModuleCatalog).toHaveLength(18);
    expect(new Set(healthModuleCatalog.map(item => item.id)).size).toBe(18);
  });

  it('has a real route for every module', () => {
    for (const module of healthModuleCatalog) {
      expect(module.route).toBe(`/health/operations/modules/${module.id}`);
    }
  });
});
