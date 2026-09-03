import type { TenantScope } from '../../core/src';

export type BillStatus = 'draft' | 'open' | 'partially_paid' | 'paid' | 'overdue';
export type ApprovalStatus = 'pending' | 'approved' | 'not_required';
export type AgingBucket = 'current' | '1-30' | '31-60' | '61-90' | '90+';
export type DueWindow = 'all' | 'overdue' | '7' | '30';

export type Vendor = TenantScope & {
  id: string;
  name: string;
  vendorCode: string;
  paymentTerms: string;
  isActive: boolean;
};

export type Bill = TenantScope & {
  id: string;
  vendorId: string;
  billNumber: string;
  issueDate: string;
  dueDate: string;
  currency: 'USD';
  totalAmount: number;
  amountPaid: number;
  status: Exclude<BillStatus, 'overdue'>;
  approvalStatus: ApprovalStatus;
  description: string;
  journalEntryId?: string;
};

export type PaymentApplication = TenantScope & {
  id: string;
  billId: string;
  appliedAt: string;
  amount: number;
  reference: string;
  source: 'demo-ledger';
};

export type PayablesFilters = {
  query: string;
  status: BillStatus | 'all';
  dueWindow: DueWindow;
};

export function parseIsoDate(value: string) {
  return new Date(`${value}T00:00:00Z`);
}

export function openBalance(bill: Bill) {
  return Math.max(0, Number((bill.totalAmount - bill.amountPaid).toFixed(2)));
}

export function effectiveStatus(bill: Bill, asOf: string): BillStatus {
  if (openBalance(bill) === 0) return 'paid';
  if (bill.status === 'draft') return 'draft';
  if (parseIsoDate(bill.dueDate).getTime() < parseIsoDate(asOf).getTime()) return 'overdue';
  if (bill.amountPaid > 0) return 'partially_paid';
  return 'open';
}

export function daysPastDue(bill: Bill, asOf: string) {
  const delta = parseIsoDate(asOf).getTime() - parseIsoDate(bill.dueDate).getTime();
  return Math.max(0, Math.floor(delta / 86_400_000));
}

export function agingBucket(bill: Bill, asOf: string): AgingBucket {
  const days = daysPastDue(bill, asOf);
  if (days === 0) return 'current';
  if (days <= 30) return '1-30';
  if (days <= 60) return '31-60';
  if (days <= 90) return '61-90';
  return '90+';
}

export function summarizeAging(bills: readonly Bill[], asOf: string) {
  const summary: Record<AgingBucket, number> = {
    current: 0,
    '1-30': 0,
    '31-60': 0,
    '61-90': 0,
    '90+': 0
  };

  for (const bill of bills) {
    const balance = openBalance(bill);
    if (balance === 0 || bill.status === 'draft') continue;
    summary[agingBucket(bill, asOf)] += balance;
  }

  return summary;
}

export function summarizePayables(bills: readonly Bill[], asOf: string) {
  const openBills = bills.filter((bill) => openBalance(bill) > 0 && bill.status !== 'draft');
  const totalOpen = openBills.reduce((sum, bill) => sum + openBalance(bill), 0);
  const overdue = openBills
    .filter((bill) => effectiveStatus(bill, asOf) === 'overdue')
    .reduce((sum, bill) => sum + openBalance(bill), 0);
  const pendingApproval = openBills
    .filter((bill) => bill.approvalStatus === 'pending')
    .reduce((sum, bill) => sum + openBalance(bill), 0);

  return {
    totalOpen: Number(totalOpen.toFixed(2)),
    overdue: Number(overdue.toFixed(2)),
    pendingApproval: Number(pendingApproval.toFixed(2)),
    openCount: openBills.length
  };
}

function dueWindowMatches(bill: Bill, dueWindow: DueWindow, asOf: string) {
  if (dueWindow === 'all') return true;
  const due = parseIsoDate(bill.dueDate).getTime();
  const today = parseIsoDate(asOf).getTime();
  if (dueWindow === 'overdue') return due < today && openBalance(bill) > 0;
  const days = Number(dueWindow);
  const lastDay = today + days * 86_400_000;
  return due >= today && due <= lastDay && openBalance(bill) > 0;
}

export function filterBills(
  bills: readonly Bill[],
  vendors: readonly Vendor[],
  filters: PayablesFilters,
  asOf: string
) {
  const vendorById = new Map(vendors.map((vendor) => [vendor.id, vendor]));
  const query = filters.query.trim().toLowerCase();

  return bills.filter((bill) => {
    const vendor = vendorById.get(bill.vendorId);
    const searchMatches =
      !query ||
      bill.billNumber.toLowerCase().includes(query) ||
      bill.description.toLowerCase().includes(query) ||
      vendor?.name.toLowerCase().includes(query) ||
      vendor?.vendorCode.toLowerCase().includes(query);
    const statusMatches =
      filters.status === 'all' || effectiveStatus(bill, asOf) === filters.status;
    return searchMatches && statusMatches && dueWindowMatches(bill, filters.dueWindow, asOf);
  });
}
