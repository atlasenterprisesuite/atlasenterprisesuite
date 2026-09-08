export interface StraightLineScheduleInput {
  cost: number;
  salvageValue: number;
  usefulLifeMonths: number;
  acquisitionDate: string;
}

export interface DepreciationScheduleRow {
  period: string;
  depreciation: number;
  accumulatedDepreciation: number;
  bookValue: number;
}

function money(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function requireFiniteNonNegative(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${label} must be a finite non-negative amount`);
  }
}

function parseDateOnly(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error('Acquisition date must use YYYY-MM-DD');
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error('Acquisition date is invalid');
  }
  return date;
}

export function straightLineSchedule(input: StraightLineScheduleInput): DepreciationScheduleRow[] {
  requireFiniteNonNegative(input.cost, 'Cost');
  requireFiniteNonNegative(input.salvageValue, 'Salvage value');

  if (input.salvageValue > input.cost) {
    throw new Error('Salvage value cannot exceed asset cost');
  }
  if (!Number.isInteger(input.usefulLifeMonths) || input.usefulLifeMonths <= 0) {
    throw new Error('Useful life months must be a positive integer');
  }

  const acquisition = parseDateOnly(input.acquisitionDate);
  const depreciableBasis = money(input.cost - input.salvageValue);
  const regularMonthlyDepreciation = money(depreciableBasis / input.usefulLifeMonths);
  let accumulated = 0;

  return Array.from({ length: input.usefulLifeMonths }, (_, index) => {
    const periodDate = new Date(Date.UTC(
      acquisition.getUTCFullYear(),
      acquisition.getUTCMonth() + index,
      1,
    ));
    const remainingBasis = money(depreciableBasis - accumulated);
    const depreciation = index === input.usefulLifeMonths - 1
      ? remainingBasis
      : Math.min(regularMonthlyDepreciation, remainingBasis);
    accumulated = money(accumulated + depreciation);

    return {
      period: periodDate.toISOString().slice(0, 7),
      depreciation,
      accumulatedDepreciation: accumulated,
      bookValue: money(input.cost - accumulated),
    };
  });
}
