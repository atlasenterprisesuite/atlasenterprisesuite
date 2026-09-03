import { describe, expect, it } from 'vitest';
import { agingBucket, effectiveStatus, filterBills, openBalance, summarizeAging, summarizePayables } from '../../packages/accounting/src';
import { bills, payablesAsOf, vendors } from '../../data/demo/accounting/payablesSeed';

describe('ATLAS Accounts Payable domain', () => {
  it('calculates open balance without going negative', () => {
    expect(openBalance(bills[1])).toBe(5650);
    expect(openBalance(bills[3])).toBe(0);
  });

  it('derives overdue status from due date and open balance', () => {
    expect(effectiveStatus(bills[0], payablesAsOf)).toBe('overdue');
    expect(effectiveStatus(bills[3], payablesAsOf)).toBe('paid');
  });

  it('calculates deterministic AP totals from the same bill dataset', () => {
    expect(summarizePayables(bills, payablesAsOf)).toEqual({
      totalOpen: 22430,
      overdue: 9930,
      pendingApproval: 12500,
      openCount: 3
    });
  });

  it('buckets unpaid bills by aging', () => {
    expect(agingBucket(bills[0], payablesAsOf)).toBe('1-30');
    expect(summarizeAging(bills, payablesAsOf)).toEqual({
      current: 12500,
      '1-30': 9930,
      '31-60': 0,
      '61-90': 0,
      '90+': 0
    });
  });

  it('filters by vendor query and overdue state', () => {
    const result = filterBills(bills, vendors, { query: 'Blue Harbor', status: 'overdue', dueWindow: 'all' }, payablesAsOf);
    expect(result.map((bill) => bill.id)).toEqual(['bill-002']);
  });
});
