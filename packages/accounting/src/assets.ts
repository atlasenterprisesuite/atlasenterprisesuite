export type StraightLineAssetInput = {
  cost: number;
  salvageValue: number;
  usefulLifeMonths: number;
  acquisitionDate: string;
};

export type DepreciationScheduleRow = {
  period: number;
  periodDate: string;
  depreciation: number;
  accumulatedDepreciation: number;
  endingBookValue: number;
};

function asCents(value: number, label: string): number {
  if (!Number.isFinite(value)) throw new Error(`${label} must be finite`);
  return Math.round(value * 100);
}

function monthDate(acquisitionDate: string, offset: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(acquisitionDate);
  if (!match) throw new Error('Acquisition date must use YYYY-MM-DD');

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year
    || parsed.getUTCMonth() !== month - 1
    || parsed.getUTCDate() !== day
  ) {
    throw new Error('Acquisition date is invalid');
  }

  const periodDate = new Date(Date.UTC(year, month - 1 + offset, 1));
  return periodDate.toISOString().slice(0, 10);
}

export function straightLineSchedule(input: StraightLineAssetInput): DepreciationScheduleRow[] {
  const costCents = asCents(input.cost, 'Cost');
  const salvageCents = asCents(input.salvageValue, 'Salvage value');

  if (costCents < 0) throw new Error('Cost cannot be negative');
  if (salvageCents < 0) throw new Error('Salvage value cannot be negative');
  if (salvageCents > costCents) throw new Error('Salvage value cannot exceed cost');
  if (!Number.isInteger(input.usefulLifeMonths) || input.usefulLifeMonths <= 0) {
    throw new Error('Useful life months must be a positive integer');
  }

  // Validate the date even when the depreciable basis is zero.
  monthDate(input.acquisitionDate, 0);

  const depreciableBasisCents = costCents - salvageCents;
  const baseMonthlyCents = Math.floor(depreciableBasisCents / input.usefulLifeMonths);
  const remainderCents = depreciableBasisCents % input.usefulLifeMonths;
  let accumulatedCents = 0;

  return Array.from({ length: input.usefulLifeMonths }, (_, index) => {
    const depreciationCents = baseMonthlyCents + (index < remainderCents ? 1 : 0);
    accumulatedCents += depreciationCents;

    return {
      period: index + 1,
      periodDate: monthDate(input.acquisitionDate, index),
      depreciation: depreciationCents / 100,
      accumulatedDepreciation: accumulatedCents / 100,
      endingBookValue: (costCents - accumulatedCents) / 100,
    };
  });
}
