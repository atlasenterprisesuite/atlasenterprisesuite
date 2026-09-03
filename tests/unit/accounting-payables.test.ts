import { describe, expect, it } from 'vitest';
import {
  agingBucket,
  effectiveStatus,
  filterBills,
  openBalance,
  scopePayablesData,
  summarizeAging,
  summarizePayables
} from '../../packages/accounting/src';
import { bills, payablesAsOf, paymentApplications, vendors } from '../../data/demo/accounting/payablesSeed';

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

  it('excludes vendors, bills, and payments outside the active tenant scope', () => {
    const foreignScope = { tenantId: 'tenant-foreign', organizationId: 'org-foreign' };
    const foreignVendor = { ...vendors[0], ...foreignScope, id: 'vendor-foreign', vendorCode: 'V-FOREIGN', name: 'Foreign Vendor' };
    const foreignBill = { ...bills[0], ...foreignScope, id: 'bill-foreign', vendorId: foreignVendor.id, billNumber: 'FOREIGN-001' };
    const foreignPayment = { ...paymentApplications[0], ...foreignScope, id: 'payapp-foreign', billId: foreignBill.id, reference: 'FOREIGN-PMT' };

    const scoped = scopePayablesData(
      { tenantId: 'tenant-demo', organizationId: 'org-demo' },
      [...vendors, foreignVendor],
      [...bills, foreignBill],
      [...paymentApplications, foreignPayment]
    );

    expect(scoped.vendors.some((vendor) => vendor.id === foreignVendor.id)).toBe(false);
    expect(scoped.bills.some((bill) => bill.id === foreignBill.id)).toBe(false);
    expect(scoped.paymentApplications.some((payment) => payment.id === foreignPayment.id)).toBe(false);
  });
});
