import { describe, expect, it } from 'vitest';
import {
  calculatePayrollLine,
  transitionPayrollRun,
  type PayrollRun,
} from '../../packages/people/src';

const calculatedRun: PayrollRun = {
  id: 'payroll-1',
  organizationId: 'org-a',
  periodStart: '2026-08-31',
  periodEnd: '2026-09-06',
  payDate: '2026-09-11',
  status: 'calculated',
  approvedBy: null,
  approvedAt: null,
  voidReason: null,
  createdAt: '2026-09-06T12:00:00Z',
  updatedAt: '2026-09-06T12:00:00Z',
};

describe('ATLAS People payroll calculation', () => {
  it('calculates hourly regular and overtime pay using integer-cent arithmetic', () => {
    expect(calculatePayrollLine({
      regularHours: 40,
      overtimeHours: 5,
      hourlyRate: 20,
      overtimeMultiplier: 1.5,
      salaryPeriodAmount: null,
      pretaxDeductions: 50,
      taxesWithheld: 150,
      posttaxDeductions: 25,
    })).toEqual({
      regularPay: 800,
      overtimePay: 150,
      grossPay: 950,
      pretaxDeductions: 50,
      taxesWithheld: 150,
      posttaxDeductions: 25,
      netPay: 725,
    });
  });

  it('uses a salary-period amount without inventing hourly earnings', () => {
    expect(calculatePayrollLine({
      regularHours: 0,
      overtimeHours: 0,
      hourlyRate: null,
      overtimeMultiplier: 1.5,
      salaryPeriodAmount: 2500.15,
      pretaxDeductions: 100.05,
      taxesWithheld: 400.1,
      posttaxDeductions: 25,
    })).toMatchObject({
      regularPay: 0,
      overtimePay: 0,
      grossPay: 2500.15,
      netPay: 1975,
    });
  });

  it('rounds fractional-hour earnings to cents deterministically', () => {
    expect(calculatePayrollLine({
      regularHours: 1.25,
      overtimeHours: 0,
      hourlyRate: 19.99,
      overtimeMultiplier: 1.5,
      salaryPeriodAmount: null,
      pretaxDeductions: 0,
      taxesWithheld: 0,
      posttaxDeductions: 0,
    }).grossPay).toBe(24.99);
  });

  it('rejects negative values, conflicting compensation sources, and deductions above gross', () => {
    expect(() => calculatePayrollLine({
      regularHours: -1,
      overtimeHours: 0,
      hourlyRate: 20,
      overtimeMultiplier: 1.5,
      salaryPeriodAmount: null,
      pretaxDeductions: 0,
      taxesWithheld: 0,
      posttaxDeductions: 0,
    })).toThrow('Regular hours cannot be negative.');

    expect(() => calculatePayrollLine({
      regularHours: 40,
      overtimeHours: 0,
      hourlyRate: 20,
      overtimeMultiplier: 1.5,
      salaryPeriodAmount: 1000,
      pretaxDeductions: 0,
      taxesWithheld: 0,
      posttaxDeductions: 0,
    })).toThrow('Use either hourly rate or salary-period amount, not both.');

    expect(() => calculatePayrollLine({
      regularHours: 1,
      overtimeHours: 0,
      hourlyRate: 10,
      overtimeMultiplier: 1.5,
      salaryPeriodAmount: null,
      pretaxDeductions: 5,
      taxesWithheld: 6,
      posttaxDeductions: 0,
    })).toThrow('Payroll deductions and withholding cannot exceed gross pay.');
  });
});

describe('ATLAS People payroll lifecycle', () => {
  it('moves a draft payroll to calculated without claiming payment or filing state', () => {
    const draft: PayrollRun = { ...calculatedRun, status: 'draft' };
    const next = transitionPayrollRun(draft, { type: 'calculate' }, {
      userId: 'payroll-user',
      at: '2026-09-06T13:00:00Z',
      permissions: ['payroll.write'],
    });

    expect(next.status).toBe('calculated');
    expect(next.approvedBy).toBeNull();
    expect(next.approvedAt).toBeNull();
  });

  it('requires payroll.approve to approve and lock a payroll run', () => {
    expect(() => transitionPayrollRun(calculatedRun, { type: 'approve' }, {
      userId: 'payroll-user',
      at: '2026-09-06T13:00:00Z',
      permissions: ['payroll.write'],
    })).toThrow('payroll.approve permission is required.');

    const approved = transitionPayrollRun(calculatedRun, { type: 'approve' }, {
      userId: 'approver-a',
      at: '2026-09-06T13:00:00Z',
      permissions: ['payroll.approve'],
    });
    expect(approved).toMatchObject({
      status: 'approved',
      approvedBy: 'approver-a',
      approvedAt: '2026-09-06T13:00:00Z',
    });

    const locked = transitionPayrollRun(approved, { type: 'lock' }, {
      userId: 'approver-a',
      at: '2026-09-06T14:00:00Z',
      permissions: ['payroll.approve'],
    });
    expect(locked.status).toBe('locked');
  });

  it('requires an audit reason and approval permission to void a run', () => {
    expect(() => transitionPayrollRun(calculatedRun, { type: 'void', reason: '   ' }, {
      userId: 'approver-a',
      at: '2026-09-06T13:00:00Z',
      permissions: ['payroll.approve'],
    })).toThrow('Void reason is required.');

    const voided = transitionPayrollRun(calculatedRun, { type: 'void', reason: 'Duplicate payroll run' }, {
      userId: 'approver-a',
      at: '2026-09-06T13:00:00Z',
      permissions: ['payroll.approve'],
    });
    expect(voided).toMatchObject({ status: 'void', voidReason: 'Duplicate payroll run' });
  });

  it('rejects invalid lifecycle jumps', () => {
    const draft: PayrollRun = { ...calculatedRun, status: 'draft' };
    expect(() => transitionPayrollRun(draft, { type: 'approve' }, {
      userId: 'approver-a',
      at: '2026-09-06T13:00:00Z',
      permissions: ['payroll.approve'],
    })).toThrow('Payroll run must be calculated before approval.');
  });
});
