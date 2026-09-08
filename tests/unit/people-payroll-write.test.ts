import { describe, expect, it, vi } from 'vitest';
import {
  PeoplePayrollWriteService,
  type CreatePayrollRunCommand,
  type PeoplePayrollWriteGateway,
  type SavePayrollLineCommand,
} from '../../packages/people/src';

function gatewayFixture(): PeoplePayrollWriteGateway & {
  createPayrollRun: ReturnType<typeof vi.fn>;
  savePayrollLine: ReturnType<typeof vi.fn>;
  calculatePayrollRun: ReturnType<typeof vi.fn>;
  approvePayrollRun: ReturnType<typeof vi.fn>;
  lockPayrollRun: ReturnType<typeof vi.fn>;
  voidPayrollRun: ReturnType<typeof vi.fn>;
} {
  return {
    createPayrollRun: vi.fn(async (_command: CreatePayrollRunCommand) => 'payroll-1'),
    savePayrollLine: vi.fn(async (_command: SavePayrollLineCommand) => 'line-1'),
    calculatePayrollRun: vi.fn(async () => 'payroll-1'),
    approvePayrollRun: vi.fn(async () => 'payroll-1'),
    lockPayrollRun: vi.fn(async () => 'payroll-1'),
    voidPayrollRun: vi.fn(async () => 'payroll-1'),
  };
}

describe('ATLAS People payroll write service', () => {
  it('validates payroll run dates before creating a run', async () => {
    const gateway = gatewayFixture();
    const service = new PeoplePayrollWriteService(gateway);

    await expect(service.createPayrollRun({
      organizationId: ' org-a ',
      periodStart: '2026-08-31',
      periodEnd: '2026-09-06',
      payDate: '2026-09-11',
    })).resolves.toBe('payroll-1');

    expect(gateway.createPayrollRun).toHaveBeenCalledWith({
      organizationId: 'org-a',
      periodStart: '2026-08-31',
      periodEnd: '2026-09-06',
      payDate: '2026-09-11',
    });

    await expect(service.createPayrollRun({
      organizationId: 'org-a',
      periodStart: '2026-09-07',
      periodEnd: '2026-09-06',
      payDate: '2026-09-11',
    })).rejects.toThrow('Payroll period end must be on or after period start.');
  });

  it('calculates a payroll line before sending exact calculation evidence to the gateway', async () => {
    const gateway = gatewayFixture();
    const service = new PeoplePayrollWriteService(gateway);

    await expect(service.savePayrollLine({
      organizationId: 'org-a',
      payrollRunId: 'payroll-1',
      employeeId: 'employee-a',
      calculationInput: {
        regularHours: 40,
        overtimeHours: 5,
        hourlyRate: 20,
        overtimeMultiplier: 1.5,
        salaryPeriodAmount: null,
        pretaxDeductions: 50,
        taxesWithheld: 150,
        posttaxDeductions: 25,
      },
    })).resolves.toBe('line-1');

    expect(gateway.savePayrollLine).toHaveBeenCalledWith(expect.objectContaining({
      organizationId: 'org-a',
      payrollRunId: 'payroll-1',
      employeeId: 'employee-a',
      calculation: expect.objectContaining({ grossPay: 950, netPay: 725 }),
    }));
  });

  it('requires a non-empty void reason before calling the gateway', async () => {
    const gateway = gatewayFixture();
    const service = new PeoplePayrollWriteService(gateway);

    await expect(service.voidPayrollRun({
      organizationId: 'org-a',
      payrollRunId: 'payroll-1',
      reason: '   ',
    })).rejects.toThrow('Void reason is required.');

    expect(gateway.voidPayrollRun).not.toHaveBeenCalled();
  });
});
