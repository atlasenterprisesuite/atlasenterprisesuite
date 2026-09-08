import {
  calculatePayrollLine,
  type PayrollCalculation,
  type PayrollCalculationInput,
} from './payroll';

export type CreatePayrollRunCommand = {
  organizationId: string;
  periodStart: string;
  periodEnd: string;
  payDate: string;
};

export type SavePayrollLineCommand = {
  organizationId: string;
  payrollRunId: string;
  employeeId: string;
  calculationInput: PayrollCalculationInput;
};

export type PersistPayrollLineCommand = SavePayrollLineCommand & {
  calculation: PayrollCalculation;
};

export type PayrollRunCommand = {
  organizationId: string;
  payrollRunId: string;
};

export type VoidPayrollRunCommand = PayrollRunCommand & {
  reason: string;
};

export interface PeoplePayrollWriteGateway {
  createPayrollRun(command: CreatePayrollRunCommand): Promise<string>;
  savePayrollLine(command: PersistPayrollLineCommand): Promise<string>;
  calculatePayrollRun(command: PayrollRunCommand): Promise<string>;
  approvePayrollRun(command: PayrollRunCommand): Promise<string>;
  lockPayrollRun(command: PayrollRunCommand): Promise<string>;
  voidPayrollRun(command: VoidPayrollRunCommand): Promise<string>;
}

function requireText(value: string, message: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(message);
  return normalized;
}

function requireDateOnly(value: string, label: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) {
    throw new Error(`${label} must be YYYY-MM-DD.`);
  }
  return value;
}

function normalizeRunCommand(command: PayrollRunCommand): PayrollRunCommand {
  return {
    organizationId: requireText(command.organizationId, 'Organization is required'),
    payrollRunId: requireText(command.payrollRunId, 'Payroll run is required'),
  };
}

export class PeoplePayrollWriteService {
  constructor(private readonly gateway: PeoplePayrollWriteGateway) {}

  async createPayrollRun(command: CreatePayrollRunCommand): Promise<string> {
    const organizationId = requireText(command.organizationId, 'Organization is required');
    const periodStart = requireDateOnly(command.periodStart, 'Payroll period start');
    const periodEnd = requireDateOnly(command.periodEnd, 'Payroll period end');
    const payDate = requireDateOnly(command.payDate, 'Payroll pay date');

    if (periodEnd < periodStart) {
      throw new Error('Payroll period end must be on or after period start.');
    }

    return this.gateway.createPayrollRun({ organizationId, periodStart, periodEnd, payDate });
  }

  async savePayrollLine(command: SavePayrollLineCommand): Promise<string> {
    const normalized: SavePayrollLineCommand = {
      organizationId: requireText(command.organizationId, 'Organization is required'),
      payrollRunId: requireText(command.payrollRunId, 'Payroll run is required'),
      employeeId: requireText(command.employeeId, 'Employee is required'),
      calculationInput: command.calculationInput,
    };
    const calculation = calculatePayrollLine(normalized.calculationInput);
    return this.gateway.savePayrollLine({ ...normalized, calculation });
  }

  async calculatePayrollRun(command: PayrollRunCommand): Promise<string> {
    return this.gateway.calculatePayrollRun(normalizeRunCommand(command));
  }

  async approvePayrollRun(command: PayrollRunCommand): Promise<string> {
    return this.gateway.approvePayrollRun(normalizeRunCommand(command));
  }

  async lockPayrollRun(command: PayrollRunCommand): Promise<string> {
    return this.gateway.lockPayrollRun(normalizeRunCommand(command));
  }

  async voidPayrollRun(command: VoidPayrollRunCommand): Promise<string> {
    const normalized = normalizeRunCommand(command);
    const reason = requireText(command.reason, 'Void reason is required.');
    return this.gateway.voidPayrollRun({ ...normalized, reason });
  }
}
