import { describe, expect, it } from 'vitest';
import { requireRevenuePermission, revenuePermissions } from '../../packages/revenue-ops/src/writes';

const baseContext = {
  scope: { tenantId: 'tenant-1', organizationId: 'org-1' },
  actor: { actorId: 'user-1', permissions: [revenuePermissions.crmManage] },
};

describe('Revenue Ops governed writes', () => {
  it('allows a scoped actor with the required permission', () => {
    expect(() => requireRevenuePermission(baseContext, revenuePermissions.crmManage)).not.toThrow();
  });

  it('rejects missing permissions', () => {
    expect(() => requireRevenuePermission(baseContext, revenuePermissions.salesManage)).toThrow(
      'Missing required permission',
    );
  });

  it('rejects missing actor or scope', () => {
    expect(() =>
      requireRevenuePermission({ ...baseContext, actor: { actorId: '', permissions: [] } }, revenuePermissions.crmManage),
    ).toThrow('authenticated actor');

    expect(() =>
      requireRevenuePermission(
        { ...baseContext, scope: { tenantId: '', organizationId: 'org-1' } },
        revenuePermissions.crmManage,
      ),
    ).toThrow('tenant and organization');
  });
});
