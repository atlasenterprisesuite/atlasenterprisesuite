import { describe, expect, it } from 'vitest';
import {
  FEDERAL_BENEFITS_2025,
  calculateOrdinaryLine16Tax2025,
  federalBenefit2025,
  lookupTaxTable2025
} from '../../packages/tax-forms/src';

describe('ATLAS Tax 2025 IRS Tax Table', () => {
  it('matches the IRS published example for $25,300-$25,350 MFJ', () => {
    const result = lookupTaxTable2025(25300, 'married-filing-jointly');
    expect(result.rangeStart).toBe(25300);
    expect(result.rangeEnd).toBe(25350);
    expect(result.tax).toBe(2562);
  });

  it('matches published table values at the upper boundary below $100,000', () => {
    expect(lookupTaxTable2025(99950, 'single').tax).toBe(16909);
    expect(lookupTaxTable2025(99950, 'married-filing-jointly').tax).toBe(11823);
    expect(lookupTaxTable2025(99950, 'married-filing-separately').tax).toBe(16909);
    expect(lookupTaxTable2025(99950, 'head-of-household').tax).toBe(15170);
  });

  it('reproduces the special low-income Tax Table bands', () => {
    expect(lookupTaxTable2025(0, 'single')).toEqual(expect.objectContaining({ rangeStart: 0, rangeEnd: 5, tax: 0 }));
    expect(lookupTaxTable2025(5, 'single')).toEqual(expect.objectContaining({ rangeStart: 5, rangeEnd: 15, tax: 1 }));
    expect(lookupTaxTable2025(15, 'single')).toEqual(expect.objectContaining({ rangeStart: 15, rangeEnd: 25, tax: 2 }));
    expect(lookupTaxTable2025(25, 'single')).toEqual(expect.objectContaining({ rangeStart: 25, rangeEnd: 50, tax: 4 }));
  });

  it('switches to the Tax Computation Worksheet at $100,000', () => {
    expect(calculateOrdinaryLine16Tax2025(99999, 'single').method).toBe('tax-table');
    expect(calculateOrdinaryLine16Tax2025(100000, 'single').method).toBe('tax-computation-worksheet');
  });

  it('uses the MFJ table for qualifying surviving spouse', () => {
    expect(lookupTaxTable2025(25300, 'qualifying-surviving-spouse').tax).toBe(2562);
  });

  it('rejects Tax Table lookup at or above $100,000', () => {
    expect(() => lookupTaxTable2025(100000, 'single')).toThrow('tax_table_2025_requires_income');
  });
});

describe('ATLAS Tax 2025 federal benefits registry', () => {
  it('registers core refundable and nonrefundable family credits', () => {
    expect(federalBenefit2025('ctc-actc')).toEqual(expect.objectContaining({
      form: 'Schedule 8812',
      refundability: 'partially-refundable'
    }));
    expect(federalBenefit2025('eitc')).toEqual(expect.objectContaining({
      refundability: 'refundable',
      support: 'worksheet-required'
    }));
    expect(federalBenefit2025('other-dependent-credit')).toEqual(expect.objectContaining({
      refundability: 'nonrefundable'
    }));
  });

  it('registers education, care, retirement, marketplace and foreign credits', () => {
    for (const id of ['dependent-care-credit','aotc','llc','savers-credit','premium-tax-credit','foreign-tax-credit','adoption-credit']) {
      expect(federalBenefit2025(id)).not.toBeNull();
    }
  });

  it('registers standard, itemized, Schedule 1, Schedule 1-A and QBI deductions', () => {
    for (const id of [
      'standard-deduction',
      'schedule-a-itemized',
      'schedule-1a-tips',
      'schedule-1a-overtime',
      'schedule-1a-car-loan-interest',
      'schedule-1a-senior',
      'qbi-199a',
      'educator-expense',
      'student-loan-interest',
      'ira-deduction',
      'hsa-deduction'
    ]) expect(federalBenefit2025(id)).not.toBeNull();
  });

  it('keeps complex benefits behind worksheets or source-document gates', () => {
    const complex = FEDERAL_BENEFITS_2025.filter((benefit) =>
      ['ctc-actc','eitc','premium-tax-credit','foreign-tax-credit','clean-vehicle-new'].includes(benefit.id)
    );
    expect(complex.every((benefit) => benefit.support !== 'automatic')).toBe(true);
  });

  it('links every registry item to an official IRS source', () => {
    expect(FEDERAL_BENEFITS_2025.length).toBeGreaterThanOrEqual(20);
    expect(FEDERAL_BENEFITS_2025.every((benefit) => benefit.officialSource.startsWith('https://www.irs.gov/'))).toBe(true);
  });
});
