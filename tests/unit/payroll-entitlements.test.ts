import { describe, expect, it } from 'vitest';
import { resolvePayrollEntitlements } from '../../packages/payroll';

describe('payroll entitlements', () => {
  it('supports internal-comp software fee exemption without waiving provider fees', () => {
    const result = resolvePayrollEntitlements({ billingMode: 'internal_comp', explicit: ['payroll.core','payroll.time'] });
    expect(result.softwareFeeExempt).toBe(true);
    expect(result.capabilities).toContain('payroll.time');
    expect(result.externalProviderFeesWaived).toBe(false);
  });
  it('does not invent customer pricing', () => {
    const result = resolvePayrollEntitlements({ billingMode: 'customer', explicit: ['payroll.core'] });
    expect(result.softwareFeeExempt).toBe(false);
    expect(result.publicPrice).toBeNull();
  });
});
