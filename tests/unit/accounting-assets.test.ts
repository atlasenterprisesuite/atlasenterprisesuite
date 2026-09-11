import { describe, expect, it } from 'vitest';
import { straightLineSchedule } from '../../packages/accounting/src';

describe('fixed asset depreciation', () => {
  it('does not depreciate beyond depreciable basis', () => {
    const schedule = straightLineSchedule({
      cost: 12000,
      salvageValue: 0,
      usefulLifeMonths: 12,
      acquisitionDate: '2026-01-01',
    });

    expect(schedule).toHaveLength(12);
    expect(schedule.reduce((sum, row) => sum + row.depreciation, 0)).toBe(12000);
    expect(schedule.at(-1)?.endingBookValue).toBe(0);
  });

  it('preserves salvage value after the final month', () => {
    const schedule = straightLineSchedule({
      cost: 10000,
      salvageValue: 1000,
      usefulLifeMonths: 36,
      acquisitionDate: '2026-02-15',
    });

    expect(schedule.reduce((sum, row) => sum + row.depreciation, 0)).toBe(9000);
    expect(schedule.at(-1)?.endingBookValue).toBe(1000);
  });

  it('rejects invalid economic inputs', () => {
    expect(() => straightLineSchedule({
      cost: 1000,
      salvageValue: 1100,
      usefulLifeMonths: 12,
      acquisitionDate: '2026-01-01',
    })).toThrow(/salvage/i);

    expect(() => straightLineSchedule({
      cost: 1000,
      salvageValue: 0,
      usefulLifeMonths: 0,
      acquisitionDate: '2026-01-01',
    })).toThrow(/useful life/i);
  });
});
