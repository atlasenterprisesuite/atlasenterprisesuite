import { describe, expect, it } from 'vitest';
import { canGrantPayrollPermission, hasPayrollPermission } from '../../packages/payroll';

describe('payroll permissions', () => {
  it('does not let a payroll admin grant organization-owner authority', () => {
    expect(canGrantPayrollPermission('payroll_admin', 'platform.billing.internal_comp.manage')).toBe(false);
  });
  it('lets a payroll approver approve but not process payroll', () => {
    expect(hasPayrollPermission('payroll_approver', 'payroll.run.approve')).toBe(true);
    expect(hasPayrollPermission('payroll_approver', 'payroll.run.process')).toBe(false);
  });
});
