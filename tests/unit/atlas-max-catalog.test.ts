import { describe, expect, it } from 'vitest';
import { getPlanCatalog } from '../../apps/web/src/services/atlas-max/catalog';
import type { AtlasPlanId, SpeedClass } from '../../apps/web/src/services/atlas-max/contracts';

describe('ATLAS MAX plan catalog', () => {
  it('defines exactly the Core, Pro, and MAX plan ids', () => {
    const ids: AtlasPlanId[] = getPlanCatalog().map((plan) => plan.id);
    expect(ids).toEqual(['core', 'pro', 'max']);
  });

  it('uses provider-neutral speed classes', () => {
    const speeds: SpeedClass[] = ['standard', 'fast', 'max'];
    expect(speeds).toEqual(['standard', 'fast', 'max']);
  });

  it('keeps commercial capability metadata in catalog data instead of UI truth', () => {
    const max = getPlanCatalog().find((plan) => plan.id === 'max');
    expect(max).toMatchObject({
      id: 'max',
      displayName: 'ATLAS MAX',
      speedClasses: ['standard', 'fast', 'max'],
    });
    expect(max?.capabilities).toContain('persistent-operators');
    expect(max?.capabilities).toContain('priority-execution');
  });
});
