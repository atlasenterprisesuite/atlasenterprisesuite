export type PayType = 'hourly' | 'salary';
export type DeductionTreatment = 'pretax' | 'posttax';
export type DeductionCalculationType = 'fixed' | 'percent';

export interface CompensationRecord {
  id: string;
  organizationId: string;
  employeeId: string;
  payType: PayType;
  hourlyRate: number | null;
  annualSalary: number | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DeductionRule {
  calculationType: DeductionCalculationType;
  amount: number;
}

function requireDateOnly(value: string, label: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) {
    throw new Error(`${label} must be YYYY-MM-DD.`);
  }
  return value;
}

export function validateCompensationHistory(history: readonly CompensationRecord[]): readonly CompensationRecord[] {
  const byEmployee = new Map<string, CompensationRecord[]>();

  for (const item of history) {
    requireDateOnly(item.effectiveFrom, 'Compensation effective start');
    if (item.effectiveTo) {
      requireDateOnly(item.effectiveTo, 'Compensation effective end');
      if (item.effectiveTo < item.effectiveFrom) {
        throw new Error('Compensation effective end must be on or after the start.');
      }
    }
    if (item.payType === 'hourly' && (item.hourlyRate === null || item.hourlyRate < 0 || item.annualSalary !== null)) {
      throw new Error('Hourly compensation requires a non-negative hourly rate only.');
    }
    if (item.payType === 'salary' && (item.annualSalary === null || item.annualSalary < 0 || item.hourlyRate !== null)) {
      throw new Error('Salary compensation requires a non-negative annual salary only.');
    }

    const key = `${item.organizationId}:${item.employeeId}`;
    const group = byEmployee.get(key) ?? [];
    group.push(item);
    byEmployee.set(key, group);
  }

  for (const group of byEmployee.values()) {
    const sorted = [...group].sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
    for (let index = 1; index < sorted.length; index += 1) {
      const previous = sorted[index - 1];
      const current = sorted[index];
      if (previous.effectiveTo === null || current.effectiveFrom <= previous.effectiveTo) {
        throw new Error('Compensation effective ranges overlap.');
      }
    }
  }

  return history;
}

export function selectCompensation(
  history: readonly CompensationRecord[],
  effectiveOn: string,
): CompensationRecord | null {
  requireDateOnly(effectiveOn, 'Compensation effective date');
  validateCompensationHistory(history);

  const matches = history.filter((item) =>
    item.effectiveFrom <= effectiveOn && (item.effectiveTo === null || item.effectiveTo >= effectiveOn),
  );

  if (matches.length > 1) throw new Error('Multiple compensation records are effective on the same date.');
  return matches[0] ?? null;
}

function moneyToCents(value: number): number {
  if (!Number.isFinite(value) || value < 0) throw new Error('Money amount must be a non-negative finite number.');
  return Math.round((value + Number.EPSILON) * 100);
}

export function calculateDeductionCents(rule: DeductionRule, baseCents: number): number {
  if (!Number.isInteger(baseCents) || baseCents < 0) {
    throw new Error('Deduction base must be a non-negative integer number of cents.');
  }
  if (!Number.isFinite(rule.amount) || rule.amount < 0) {
    throw new Error('Deduction amount must be a non-negative finite number.');
  }

  if (rule.calculationType === 'fixed') return moneyToCents(rule.amount);
  if (rule.calculationType === 'percent') {
    if (rule.amount > 1) throw new Error('Percentage deduction amount must be between 0 and 1.');
    return Math.round(baseCents * rule.amount);
  }

  throw new Error('Unsupported deduction calculation type.');
}
