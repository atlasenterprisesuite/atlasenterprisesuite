import type { Bill, PaymentApplication, Vendor } from '../../../packages/accounting/src';

const scope = { tenantId: 'tenant-demo', organizationId: 'org-demo' } as const;

export const payablesDemoNotice =
  'Demo accounting data. No bank, payment processor, or production ledger connection is active.';

export const vendors: Vendor[] = [
  { ...scope, id: 'vendor-001', vendorCode: 'V-1001', name: 'Northstar Office Supply', paymentTerms: 'Net 30', isActive: true },
  { ...scope, id: 'vendor-002', vendorCode: 'V-1002', name: 'Blue Harbor Logistics', paymentTerms: 'Net 15', isActive: true },
  { ...scope, id: 'vendor-003', vendorCode: 'V-1003', name: 'Civic Cloud Systems', paymentTerms: 'Net 30', isActive: true },
  { ...scope, id: 'vendor-004', vendorCode: 'V-1004', name: 'Orion Facility Services', paymentTerms: 'Due on receipt', isActive: true }
];

export const bills: Bill[] = [
  { ...scope, id: 'bill-001', vendorId: 'vendor-001', billNumber: 'NOS-8831', issueDate: '2026-08-01', dueDate: '2026-08-31', currency: 'USD', totalAmount: 4280, amountPaid: 0, status: 'open', approvalStatus: 'approved', description: 'Office equipment and supplies', journalEntryId: 'JE-AP-1001' },
  { ...scope, id: 'bill-002', vendorId: 'vendor-002', billNumber: 'BHL-2048', issueDate: '2026-08-18', dueDate: '2026-09-02', currency: 'USD', totalAmount: 9650, amountPaid: 4000, status: 'partially_paid', approvalStatus: 'approved', description: 'Freight and distribution services', journalEntryId: 'JE-AP-1002' },
  { ...scope, id: 'bill-003', vendorId: 'vendor-003', billNumber: 'CCS-0901', issueDate: '2026-08-15', dueDate: '2026-09-14', currency: 'USD', totalAmount: 12500, amountPaid: 0, status: 'open', approvalStatus: 'pending', description: 'Enterprise cloud services', journalEntryId: 'JE-AP-1003' },
  { ...scope, id: 'bill-004', vendorId: 'vendor-004', billNumber: 'OFS-7710', issueDate: '2026-09-01', dueDate: '2026-09-01', currency: 'USD', totalAmount: 3120, amountPaid: 3120, status: 'paid', approvalStatus: 'not_required', description: 'Facility maintenance', journalEntryId: 'JE-AP-1004' },
  { ...scope, id: 'bill-005', vendorId: 'vendor-001', billNumber: 'NOS-8902', issueDate: '2026-09-02', dueDate: '2026-10-02', currency: 'USD', totalAmount: 1840, amountPaid: 0, status: 'draft', approvalStatus: 'pending', description: 'Replacement peripherals' }
];

export const paymentApplications: PaymentApplication[] = [
  { ...scope, id: 'payapp-001', billId: 'bill-002', appliedAt: '2026-08-27', amount: 4000, reference: 'DEMO-PMT-4402', source: 'demo-ledger' },
  { ...scope, id: 'payapp-002', billId: 'bill-004', appliedAt: '2026-09-01', amount: 3120, reference: 'DEMO-PMT-4411', source: 'demo-ledger' }
];

export const payablesAsOf = '2026-09-03';
