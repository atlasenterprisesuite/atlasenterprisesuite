import { describe, expect, it } from 'vitest';
import { requireRevenueScope } from '../../packages/revenue-ops/src/repository';

describe('Revenue Ops repository scope', () => {
  it('requires tenant and organization together', () => {
    expect(() => requireRevenueScope({ tenantId: '', organizationId: 'org-1' })).toThrow();
    expect(() => requireRevenueScope({ tenantId: 'tenant-1', organizationId: '' })).toThrow();
  });

  it('preserves an explicit tenant/organization scope', () => {
    expect(requireRevenueScope({ tenantId: 'tenant-1', organizationId: 'org-1' })).toEqual({
      tenantId: 'tenant-1',
      organizationId: 'org-1',
    });
  });
});
