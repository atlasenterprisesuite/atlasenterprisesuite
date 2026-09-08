import { describe, expect, it } from 'vitest';
import { straightLineSchedule } from '../../packages/accounting/src';

describe('ATLAS Accounting fixed assets', () => {
  it('never depreciates beyond depreciable basis', () => {
    const schedule = straightLineSchedule({
      cost: 12000,
      salvageValue: 0,
      usefulLifeMonths: 12,
      acquisitionDate: '2026-01-15',
    });

    expect(schedule).toHaveLength(12);
    expect(schedule.reduce((sum, row) => sum + row.depreciation, 0)).toBe(12000);
    expect(schedule.at(-1)?.bookValue).toBe(0);
  });

  it('preserves salvage value and corrects final-month rounding', () => {
    const schedule = straightLineSchedule({
      cost: 10000,
      salvageValue: 1000,
      usefulLifeMonths: 7,
      acquisitionDate: '2026-02-28',
    });

    expect(schedule.reduce((sum, row) => sum + row.depreciation, 0)).toBe(9000);
    expect(schedule.at(-1)?.accumulatedDepreciation).toBe(9000);
    expect(schedule.at(-1)?.bookValue).toBe(1000);
  });

  it('rejects invalid asset economics', () => {
    expect(() => straightLineSchedule({
      cost: 500,
      salvageValue: 600,
      usefulLifeMonths: 12,
      acquisitionDate: '2026-01-01',
    })).toThrow(/salvage/i);
  });
});
