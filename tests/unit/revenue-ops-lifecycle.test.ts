import { describe, expect, it } from 'vitest';
import {
  assertTenantScope,
  canTransitionOpportunity,
  canTransitionPurchaseOrder,
  canTransitionSalesOrder,
  canTransitionSettlement,
} from '../../packages/revenue-ops/src';

describe('ATLAS Revenue Operations lifecycle', () => {
  it('keeps terminal opportunity states terminal', () => {
    expect(canTransitionOpportunity('won', 'lost')).toBe(false);
    expect(canTransitionOpportunity('lost', 'qualified')).toBe(false);
  });

  it('enforces ordered sales and purchasing lifecycles', () => {
    expect(canTransitionSalesOrder('draft', 'approved')).toBe(true);
    expect(canTransitionSalesOrder('draft', 'fulfilled')).toBe(false);
    expect(canTransitionPurchaseOrder('approved', 'ordered')).toBe(true);
    expect(canTransitionPurchaseOrder('received', 'cancelled')).toBe(false);
  });

  it('does not allow an unconfigured POS provider to appear settled', () => {
    expect(canTransitionSettlement('unconfigured', 'settled')).toBe(false);
    expect(canTransitionSettlement('pending', 'settled')).toBe(true);
  });

  it('rejects cross-tenant or cross-organization access', () => {
    expect(() =>
      assertTenantScope(
        { tenantId: 'tenant-a', organizationId: 'org-a' },
        { tenantId: 'tenant-b', organizationId: 'org-a' },
      ),
    ).toThrow('REVENUE_OPS_SCOPE_MISMATCH');

    expect(() =>
      assertTenantScope(
        { tenantId: 'tenant-a', organizationId: 'org-a' },
        { tenantId: 'tenant-a', organizationId: 'org-b' },
      ),
    ).toThrow('REVENUE_OPS_SCOPE_MISMATCH');
  });
});
