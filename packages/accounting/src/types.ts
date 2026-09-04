export type AccountingTable =
  | 'chart_of_accounts'
  | 'journal_entries'
  | 'journal_lines'
  | 'customers'
  | 'vendors'
  | 'invoices'
  | 'payments'
  | 'audit_logs';

export interface AccountRecord {
  id: string;
  organizationId: string | null;
  accountNumber: string;
  name: string;
  accountType: string;
  active: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface JournalLineRecord {
  id: string;
  organizationId: string | null;
  journalEntryId: string | null;
  accountId: string | null;
  debit: number | null;
  credit: number | null;
  createdAt: string | null;
}

export interface JournalRecord {
  id: string;
  organizationId: string | null;
  entryNumber: string;
  entryDate: string | null;
  memo: string | null;
  status: string | null;
  createdBy: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  reversesJournalEntryId: string | null;
  lines: JournalLineRecord[];
}

export interface PartyRecord {
  id: string;
  organizationId: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  status: string | null;
  createdBy: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface InvoiceRecord {
  id: string;
  organizationId: string | null;
  customerId: string | null;
  invoiceNumber: string;
  issueDate: string | null;
  dueDate: string | null;
  total: number | null;
  balanceDue: number | null;
  status: string | null;
  createdBy: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface PaymentRecord {
  id: string;
  organizationId: string | null;
  invoiceId: string | null;
  amount: number;
  paymentDate: string | null;
  status: string | null;
  createdBy: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface AccountingAuditEvent {
  id: number;
  organizationId: string | null;
  userId: string | null;
  action: string;
  tableName: string | null;
  recordId: string | null;
  oldData: unknown;
  newData: unknown;
  createdAt: string | null;
}

export interface JournalLineInput {
  accountId: string;
  debit: number;
  credit: number;
}

export interface JournalValidationResult {
  valid: boolean;
  errors: string[];
  totalDebit: number;
  totalCredit: number;
}
