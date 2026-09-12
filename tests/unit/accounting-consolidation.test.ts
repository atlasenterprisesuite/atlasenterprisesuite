import { describe, expect, test } from 'vitest';
import {
  consolidateReportingBalances,
  intercompanyDifference,
  type ConsolidationAdjustmentLine,
  type EntityReportingBalance,
} from '../../packages/accounting/src';

const entityBalances: EntityReportingBalance[] = [
  { entityId: 'parent', accountId: 'cash', debit: 1000, credit: 0, consolidationWeight: 1 },
  { entityId: 'parent', accountId: 'revenue', debit: 0, credit: 500, consolidationWeight: 1 },
  { entityId: 'sub', accountId: 'cash', debit: 400, credit: 0, consolidationWeight: 0.75 },
  { entityId: 'sub', accountId: 'revenue', debit: 0, credit: 200, consolidationWeight: 0.75 },
];

const adjustments: ConsolidationAdjustmentLine[] = [
  { accountId: 'revenue', debit: 100, credit: 0 },
  { accountId: 'expense', debit: 0, credit: 100 },
];

describe('ATLAS consolidation math', () => {
  test('applies member consolidation weights before consolidation-only adjustments', () => {
    expect(consolidateReportingBalances(entityBalances, adjustments)).toEqual([
      { accountId: 'cash', debit: 1300, credit: 0, balance: 1300 },
      { accountId: 'expense', debit: 0, credit: 100, balance: -100 },
      { accountId: 'revenue', debit: 100, credit: 650, balance: -550 },
    ]);
  });

  test('keeps intercompany tolerance calculations at cent precision', () => {
    expect(intercompanyDifference(1000.004, 1000)).toBe(0);
    expect(intercompanyDifference(1000.02, 1000)).toBe(0.02);
  });

  test('rejects invalid consolidation weights', () => {
    expect(() => consolidateReportingBalances([
      { entityId: 'bad', accountId: 'cash', debit: 1, credit: 0, consolidationWeight: 1.2 },
    ], [])).toThrow('Consolidation weight must be between 0 and 1');
  });
});
