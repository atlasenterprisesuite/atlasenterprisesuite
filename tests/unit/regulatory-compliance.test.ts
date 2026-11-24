import { describe, expect, it } from 'vitest';
import { assessFloridaSoftwareLLC, canMarkRegulatoryFilingAccepted, type RegulatoryEntity } from '../../packages/compliance/regulatory';

const base: RegulatoryEntity = {
  tenantId: 'tenant-a', organizationId: 'org-a', jurisdiction: 'US-FL', legalForm: 'LLC',
  owners: 1, employees: 0, federalTaxTreatment: 'default_disregarded',
  floridaReemploymentAccountActive: false, floridaSalesTaxRegistrationActive: null,
};
const get = (entity: RegulatoryEntity, code: string) => assessFloridaSoftwareLLC(entity).find(item => item.code === code)?.applicability;

describe('Florida LLC regulatory obligation engine', () => {
  it('keeps annual and federal obligations with zero employees', () => {
    expect(get(base, 'FL_ANNUAL_REPORT')).toBe('required');
    expect(get(base, 'FEDERAL_INCOME_TAX')).toBe('required');
    expect(get(base, 'FEDERAL_PAYROLL')).toBe('not_applicable');
  });
  it('requires RT-6 for an active account even with zero employees', () => {
    expect(get({...base, floridaReemploymentAccountActive: true}, 'FL_REEMPLOYMENT_RT6')).toBe('required');
  });
  it('fails conservatively when RT-6 account status is unknown', () => {
    expect(get({...base, floridaReemploymentAccountActive: null}, 'FL_REEMPLOYMENT_RT6')).toBe('unknown');
  });
  it('does not assume sales tax exemption', () => {
    expect(get(base, 'FL_SALES_TAX')).toBe('conditional');
  });
  it('does not infer accepted filing without agency receipt', () => {
    expect(canMarkRegulatoryFilingAccepted('draft', 'receipt')).toBe(false);
    expect(canMarkRegulatoryFilingAccepted('submitted', null)).toBe(false);
    expect(canMarkRegulatoryFilingAccepted('submitted', 'ACK-123')).toBe(true);
  });
  it('rejects malformed tenant and employee scope', () => {
    expect(() => assessFloridaSoftwareLLC({...base, tenantId: ''})).toThrow();
    expect(() => assessFloridaSoftwareLLC({...base, employees: -1})).toThrow();
  });
});
