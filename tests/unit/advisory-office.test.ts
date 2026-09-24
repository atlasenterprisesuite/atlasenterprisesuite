import { describe, expect, it } from 'vitest';
import { AW_FINANCE_FIRM, BRAND_PRINT_PROMO_DELIVERABLES, BUSINESS_LAUNCH_360, assertAdvisoryScope, calculateLaunchReadiness, canAdvancePromoOrder } from '../../packages/advisory/src';

describe('ATLAS Advisory Office', () => {
  it('boots AW Finance as firm 001 without invented business metrics', () => {
    expect(AW_FINANCE_FIRM.firmNumber).toBe('001');
    expect(AW_FINANCE_FIRM.id).toBe('aw-finance-advisory-solutions');
  });
  it('enforces organization and firm isolation', () => {
    expect(assertAdvisoryScope({organizationId:'o1',firmId:'f1'},{organizationId:'o1',firmId:'f1'})).toEqual({ok:true});
    expect(assertAdvisoryScope({organizationId:'o1',firmId:'f1'},{organizationId:'o2',firmId:'f1'}).ok).toBe(false);
    expect(assertAdvisoryScope({organizationId:'o1',firmId:'f1'},{organizationId:'o1',firmId:'f2'}).ok).toBe(false);
  });
  it('scores readiness only from verified evidence', () => {
    const result = calculateLaunchReadiness({business_setup:true,brand:true,website:false,contact_channels:false,crm:false,payments:false,accounting:false,marketing:false,compliance:false,analytics:false});
    expect(result.score).toBe(20);
    expect(result.missing).toContain('website');
  });
  it('requires proof approval before a print order', () => {
    expect(canAdvancePromoOrder('proof_pending','ordered')).toBe(false);
    expect(canAdvancePromoOrder('proof_pending','proof_approved')).toBe(true);
    expect(canAdvancePromoOrder('proof_approved','ordered')).toBe(true);
  });
  it('contains the approved launch and physical promotion phase', () => {
    expect(BUSINESS_LAUNCH_360.phases).toContain('brand_print_promo');
    expect(BRAND_PRINT_PROMO_DELIVERABLES).toContain('business_cards');
    expect(BRAND_PRINT_PROMO_DELIVERABLES).toContain('promotional_items');
  });
});
