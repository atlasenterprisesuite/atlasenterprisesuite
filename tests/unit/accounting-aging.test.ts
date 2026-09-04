import { describe, expect, test } from 'vitest';
import { calculateAging } from '../../packages/accounting/src';

describe('Accounting aging', () => {
  test('places positive open balances into deterministic aging buckets', () => {
    const aging = calculateAging([
      { dueDate: '2026-09-10', balanceDue: 100 },
      { dueDate: '2026-08-20', balanceDue: 200 },
      { dueDate: '2026-07-20', balanceDue: 300 },
      { dueDate: '2026-06-20', balanceDue: 400 },
      { dueDate: '2026-05-20', balanceDue: 500 },
      { dueDate: '2026-01-01', balanceDue: 0 },
    ], '2026-09-04');

    expect(aging).toEqual({
      current: 100,
      days1to30: 200,
      days31to60: 300,
      days61to90: 400,
      over90: 500,
      total: 1500,
    });
  });

  test('treats an open balance without a due date as current rather than overdue', () => {
    const aging = calculateAging([
      { dueDate: null, balanceDue: 58.98 },
    ], '2026-09-04');

    expect(aging.current).toBe(58.98);
    expect(aging.total).toBe(58.98);
    expect(aging.days1to30 + aging.days31to60 + aging.days61to90 + aging.over90).toBe(0);
  });
});
