import { describe, expect, it } from 'vitest';
import {
  calculateDeductionCents,
  selectCompensation,
  validateCompensationHistory,
  type CompensationRecord,
} from '../../packages/people/src';

const history: CompensationRecord[] = [
  {
    id: 'comp-old', organizationId: 'org-a', employeeId: 'employee-a', payType: 'hourly',
    hourlyRate: 20, annualSalary: null, effectiveFrom: '2026-01-01', effectiveTo: '2026-06-30',
    createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'comp-current', organizationId: 'org-a', employeeId: 'employee-a', payType: 'hourly',
    hourlyRate: 22, annualSalary: null, effectiveFrom: '2026-07-01', effectiveTo: null,
    createdAt: '2026-07-01T00:00:00Z', updatedAt: '2026-07-01T00:00:00Z',
  },
];

describe('ATLAS People compensation rules', () => {
  it('selects the effective compensation for a date', () => {
    expect(selectCompensation(history, '2026-09-06')?.effectiveFrom).toBe('2026-07-01');
    expect(selectCompensation(history, '2026-03-01')?.id).toBe('comp-old');
  });

  it('rejects overlapping compensation ranges for the same employee', () => {
    expect(() => validateCompensationHistory([
      ...history,
      { ...history[1], id: 'comp-overlap', effectiveFrom: '2026-06-15' },
    ])).toThrow(/overlap/i);
  });

  it('calculates fixed and percentage deductions in integer cents', () => {
    expect(calculateDeductionCents({ calculationType: 'fixed', amount: 50 }, 100000)).toBe(5000);
    expect(calculateDeductionCents({ calculationType: 'percent', amount: 0.05 }, 100000)).toBe(5000);
  });

  it('rejects invalid deduction inputs', () => {
    expect(() => calculateDeductionCents({ calculationType: 'percent', amount: 1.01 }, 100000)).toThrow();
    expect(() => calculateDeductionCents({ calculationType: 'fixed', amount: -1 }, 100000)).toThrow();
  });
});
