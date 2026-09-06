import { hasPermission, type AtlasPermission } from '../../core/src';
import type { PayrollRun } from './types';

export type PayrollCalculationInput = {
  regularHours: number;
  overtimeHours: number;
  hourlyRate: number | null;
  overtimeMultiplier: number;
  salaryPeriodAmount: number | null;
  pretaxDeductions: number;
  taxesWithheld: number;
  posttaxDeductions: number;
};

export type PayrollCalculation = {
  regularPay: number;
  overtimePay: number;
  grossPay: number;
  pretaxDeductions: number;
  taxesWithheld: number;
  posttaxDeductions: number;
  netPay: number;
};

export type PayrollAction =
  | { type: 'calculate' }
  | { type: 'approve' }
  | { type: 'lock' }
  | { type: 'void'; reason: string };

export type PayrollActor = {
  userId: string;
  at: string;
  permissions: readonly AtlasPermission[];
};

function requireFiniteNonNegative(value: number, label: string): number {
  if (!Number.isFinite(value)) throw new Error(`${label} must be a finite number.`);
  if (value < 0) throw new Error(`${label} cannot be negative.`);
  return value;
}

function pow10(power: number): bigint {
  return 10n ** BigInt(power);
}

function decimalStringParts(value: number): { digits: bigint; decimalPlaces: number } {
  const text = value.toString().toLowerCase();
  const [mantissa, exponentText] = text.split('e');
  const exponent = exponentText ? Number(exponentText) : 0;
  const [whole, fraction = ''] = mantissa.split('.');
  const digits = BigInt(`${whole}${fraction}` || '0');
  return { digits, decimalPlaces: fraction.length - exponent };
}

function roundDivide(numerator: bigint, denominator: bigint): bigint {
  const quotient = numerator / denominator;
  const remainder = numerator % denominator;
  return remainder * 2n >= denominator ? quotient + 1n : quotient;
}

function decimalToScaledInt(value: number, scale: number, label: string): bigint {
  requireFiniteNonNegative(value, label);
  const { digits, decimalPlaces } = decimalStringParts(value);

  if (decimalPlaces <= scale) {
    return digits * pow10(scale - decimalPlaces);
  }

  return roundDivide(digits, pow10(decimalPlaces - scale));
}

function moneyToCents(value: number, label: string): bigint {
  return decimalToScaledInt(value, 2, label);
}

function centsToMoney(value: bigint): number {
  return Number(value) / 100;
}

function hourlyPayCents(hours: number, hourlyRate: number): bigint {
  const hoursScaled = decimalToScaledInt(hours, 4, 'Hours');
  const rateScaled = decimalToScaledInt(hourlyRate, 4, 'Hourly rate');
  return roundDivide(hoursScaled * rateScaled, pow10(6));
}

function overtimePayCents(hours: number, hourlyRate: number, multiplier: number): bigint {
  const hoursScaled = decimalToScaledInt(hours, 4, 'Overtime hours');
  const rateScaled = decimalToScaledInt(hourlyRate, 4, 'Hourly rate');
  const multiplierScaled = decimalToScaledInt(multiplier, 4, 'Overtime multiplier');
  return roundDivide(hoursScaled * rateScaled * multiplierScaled, pow10(10));
}

export function calculatePayrollLine(input: PayrollCalculationInput): PayrollCalculation {
  requireFiniteNonNegative(input.regularHours, 'Regular hours');
  requireFiniteNonNegative(input.overtimeHours, 'Overtime hours');
  requireFiniteNonNegative(input.overtimeMultiplier, 'Overtime multiplier');
  requireFiniteNonNegative(input.pretaxDeductions, 'Pretax deductions');
  requireFiniteNonNegative(input.taxesWithheld, 'Taxes withheld');
  requireFiniteNonNegative(input.posttaxDeductions, 'Posttax deductions');

  if (input.hourlyRate !== null) requireFiniteNonNegative(input.hourlyRate, 'Hourly rate');
  if (input.salaryPeriodAmount !== null) {
    requireFiniteNonNegative(input.salaryPeriodAmount, 'Salary-period amount');
  }

  if (input.hourlyRate !== null && input.salaryPeriodAmount !== null) {
    throw new Error('Use either hourly rate or salary-period amount, not both.');
  }
  if (input.hourlyRate === null && input.salaryPeriodAmount === null) {
    throw new Error('Hourly rate or salary-period amount is required.');
  }
  if (input.salaryPeriodAmount !== null && (input.regularHours !== 0 || input.overtimeHours !== 0)) {
    throw new Error('Salary-period payroll cannot include hourly earnings.');
  }
  if (input.overtimeHours > 0 && input.overtimeMultiplier <= 0) {
    throw new Error('Overtime multiplier must be greater than zero when overtime hours exist.');
  }

  let regularPayCents = 0n;
  let overtimePayValueCents = 0n;
  let grossPayCents: bigint;

  if (input.salaryPeriodAmount !== null) {
    grossPayCents = moneyToCents(input.salaryPeriodAmount, 'Salary-period amount');
  } else {
    regularPayCents = hourlyPayCents(input.regularHours, input.hourlyRate!);
    overtimePayValueCents = overtimePayCents(
      input.overtimeHours,
      input.hourlyRate!,
      input.overtimeMultiplier,
    );
    grossPayCents = regularPayCents + overtimePayValueCents;
  }

  const pretaxCents = moneyToCents(input.pretaxDeductions, 'Pretax deductions');
  const taxesCents = moneyToCents(input.taxesWithheld, 'Taxes withheld');
  const posttaxCents = moneyToCents(input.posttaxDeductions, 'Posttax deductions');
  const reductions = pretaxCents + taxesCents + posttaxCents;

  if (reductions > grossPayCents) {
    throw new Error('Payroll deductions and withholding cannot exceed gross pay.');
  }

  return {
    regularPay: centsToMoney(regularPayCents),
    overtimePay: centsToMoney(overtimePayValueCents),
    grossPay: centsToMoney(grossPayCents),
    pretaxDeductions: centsToMoney(pretaxCents),
    taxesWithheld: centsToMoney(taxesCents),
    posttaxDeductions: centsToMoney(posttaxCents),
    netPay: centsToMoney(grossPayCents - reductions),
  };
}

function requireActor(actor: PayrollActor): PayrollActor {
  const userId = actor.userId.trim();
  if (!userId) throw new Error('Payroll actor is required.');
  if (Number.isNaN(Date.parse(actor.at))) throw new Error('Payroll action timestamp is invalid.');
  return { ...actor, userId };
}

function requireApprovalPermission(actor: PayrollActor): void {
  if (!hasPermission(actor.permissions, 'payroll.approve')) {
    throw new Error('payroll.approve permission is required.');
  }
}

export function transitionPayrollRun(
  run: PayrollRun,
  action: PayrollAction,
  actorInput: PayrollActor,
): PayrollRun {
  const actor = requireActor(actorInput);

  if (action.type === 'calculate') {
    if (!hasPermission(actor.permissions, 'payroll.write')) {
      throw new Error('payroll.write permission is required.');
    }
    if (run.status !== 'draft') {
      throw new Error('Only draft payroll runs can be calculated.');
    }
    return { ...run, status: 'calculated', updatedAt: actor.at };
  }

  if (action.type === 'approve') {
    requireApprovalPermission(actor);
    if (run.status !== 'calculated') {
      throw new Error('Payroll run must be calculated before approval.');
    }
    return {
      ...run,
      status: 'approved',
      approvedBy: actor.userId,
      approvedAt: actor.at,
      updatedAt: actor.at,
    };
  }

  if (action.type === 'lock') {
    requireApprovalPermission(actor);
    if (run.status !== 'approved') {
      throw new Error('Payroll run must be approved before locking.');
    }
    return { ...run, status: 'locked', updatedAt: actor.at };
  }

  requireApprovalPermission(actor);
  const reason = action.reason.trim();
  if (!reason) throw new Error('Void reason is required.');
  if (run.status === 'void') throw new Error('Payroll run is already void.');

  return {
    ...run,
    status: 'void',
    voidReason: reason,
    updatedAt: actor.at,
  };
}
