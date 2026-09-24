import type { FilingStatus2025 } from './individual1040Engine';
import { calculateOrdinaryRateScheduleTax2025 } from './individual1040Engine';

export type TaxTableLookup2025 = {
  taxYear: 2025;
  filingStatus: FilingStatus2025;
  taxableIncome: number;
  rangeStart: number;
  rangeEnd: number;
  midpoint: number;
  tax: number;
  source: 'IRS Publication 1040 (2025) Tax Table';
};

function taxTableRange2025(taxableIncome: number): { start: number; end: number } {
  if (!Number.isFinite(taxableIncome) || taxableIncome < 0 || taxableIncome >= 100000) {
    throw new Error('tax_table_2025_requires_income_from_0_to_99999_99');
  }

  if (taxableIncome < 5) return { start: 0, end: 5 };
  if (taxableIncome < 15) return { start: 5, end: 15 };
  if (taxableIncome < 25) return { start: 15, end: 25 };

  if (taxableIncome < 3000) {
    const start = 25 + Math.floor((taxableIncome - 25) / 25) * 25;
    return { start, end: start + 25 };
  }

  const start = 3000 + Math.floor((taxableIncome - 3000) / 50) * 50;
  return { start, end: start + 50 };
}

function roundIrsTableTax(value: number): number {
  return Math.floor(value + 0.5);
}

export function lookupTaxTable2025(
  taxableIncome: number,
  filingStatus: FilingStatus2025
): TaxTableLookup2025 {
  const range = taxTableRange2025(taxableIncome);
  const midpoint = (range.start + range.end) / 2;
  const tax = roundIrsTableTax(
    calculateOrdinaryRateScheduleTax2025(midpoint, filingStatus)
  );

  return {
    taxYear: 2025,
    filingStatus,
    taxableIncome,
    rangeStart: range.start,
    rangeEnd: range.end,
    midpoint,
    tax,
    source: 'IRS Publication 1040 (2025) Tax Table'
  };
}

export function calculateOrdinaryLine16Tax2025(
  taxableIncome: number,
  filingStatus: FilingStatus2025
): {
  taxYear: 2025;
  method: 'tax-table' | 'tax-computation-worksheet';
  tax: number;
  exactForOrdinaryMethod: true;
} {
  if (!Number.isFinite(taxableIncome) || taxableIncome < 0) {
    throw new Error('invalid_taxable_income');
  }

  if (taxableIncome < 100000) {
    return {
      taxYear: 2025,
      method: 'tax-table',
      tax: lookupTaxTable2025(taxableIncome, filingStatus).tax,
      exactForOrdinaryMethod: true
    };
  }

  return {
    taxYear: 2025,
    method: 'tax-computation-worksheet',
    tax: calculateOrdinaryRateScheduleTax2025(taxableIncome, filingStatus),
    exactForOrdinaryMethod: true
  };
}
