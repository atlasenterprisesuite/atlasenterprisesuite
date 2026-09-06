import type {
  DeductionCalculationType,
  DeductionTreatment,
  PayType,
} from './compensation';

export type CreateCompensationCommand = {
  organizationId: string;
  employeeId: string;
  payType: PayType;
  hourlyRate: number | null;
  annualSalary: number | null;
  effectiveFrom: string;
  effectiveTo: string | null;
};

export type SetDeductionCommand = {
  organizationId: string;
  employeeId: string;
  code: string;
  label: string;
  treatment: DeductionTreatment;
  calculationType: DeductionCalculationType;
  amount: number;
  active: boolean;
};

export interface PeopleCompensationWriteGateway {
  createCompensation(command: CreateCompensationCommand): Promise<string>;
  setDeduction(command: SetDeductionCommand): Promise<string>;
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

function requireNonNegative(value: number, label: string): number {
  if (!Number.isFinite(value) || value < 0) throw new Error(`${label} must be a non-negative finite number.`);
  return value;
}

export class PeopleCompensationWriteService {
  constructor(private readonly gateway: PeopleCompensationWriteGateway) {}

  async createCompensation(command: CreateCompensationCommand): Promise<string> {
    const organizationId = requireText(command.organizationId, 'Organization is required');
    const employeeId = requireText(command.employeeId, 'Employee is required');
    const effectiveFrom = requireDateOnly(command.effectiveFrom, 'Effective start');
    const effectiveTo = command.effectiveTo === null ? null : requireDateOnly(command.effectiveTo, 'Effective end');
    if (effectiveTo && effectiveTo < effectiveFrom) throw new Error('Effective end must be on or after effective start.');

    if (command.payType === 'hourly') {
      if (command.hourlyRate === null || command.annualSalary !== null) {
        throw new Error('Hourly compensation requires an hourly rate and no annual salary.');
      }
      requireNonNegative(command.hourlyRate, 'Hourly rate');
    } else if (command.payType === 'salary') {
      if (command.annualSalary === null || command.hourlyRate !== null) {
        throw new Error('Salary compensation requires an annual salary and no hourly rate.');
      }
      requireNonNegative(command.annualSalary, 'Annual salary');
    } else {
      throw new Error('Unsupported compensation pay type.');
    }

    return this.gateway.createCompensation({
      ...command,
      organizationId,
      employeeId,
      effectiveFrom,
      effectiveTo,
    });
  }

  async setDeduction(command: SetDeductionCommand): Promise<string> {
    const organizationId = requireText(command.organizationId, 'Organization is required');
    const employeeId = requireText(command.employeeId, 'Employee is required');
    const code = requireText(command.code, 'Deduction code is required').toUpperCase();
    const label = requireText(command.label, 'Deduction label is required');
    const amount = requireNonNegative(command.amount, 'Deduction amount');

    if (!['pretax', 'posttax'].includes(command.treatment)) throw new Error('Unsupported deduction treatment.');
    if (!['fixed', 'percent'].includes(command.calculationType)) throw new Error('Unsupported deduction calculation type.');
    if (command.calculationType === 'percent' && amount > 1) {
      throw new Error('Percent deduction amount must be between 0 and 1.');
    }

    return this.gateway.setDeduction({
      ...command,
      organizationId,
      employeeId,
      code,
      label,
      amount,
    });
  }
}
