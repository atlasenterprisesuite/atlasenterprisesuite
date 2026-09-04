export type AccountingTable =
  | 'chart_of_accounts'
  | 'journal_entries'
  | 'journal_lines'
  | 'customers'
  | 'vendors'
  | 'invoices'
  | 'payments'
  | 'accounting_bills'
  | 'accounting_bank_accounts'
  | 'accounting_transactions'
  | 'accounting_reconciliation_sessions'
  | 'accounting_reconciliation_items'
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

export interface BillRecord {
  id: string;
  organizationId: string | null;
  entityId: string | null;
  vendorId: string | null;
  billNumber: string;
  billDate: string | null;
  dueDate: string | null;
  amount: number;
  balanceDue: number;
  approvalState: string;
  matchState: string;
  status: string;
  sourceDocumentId: string | null;
  createdBy: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface BankAccountRecord {
  id: string;
  organizationId: string | null;
  entityId: string | null;
  provider: string | null;
  providerAccountRef: string | null;
  displayName: string;
  accountType: string | null;
  currency: string;
  mask: string | null;
  connectionState: string;
  currentBalance: number | null;
  balanceAsOf: string | null;
  metadata: unknown;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface BankTransactionRecord {
  id: string;
  organizationId: string | null;
  entityId: string | null;
  bankAccountId: string | null;
  externalId: string | null;
  postedDate: string;
  description: string;
  merchant: string | null;
  amount: number;
  currency: string;
  suggestedAccountId: string | null;
  finalAccountId: string | null;
  confidence: number | null;
  status: string;
  evidenceState: string;
  reviewReason: string | null;
  flag: string | null;
  dimension: unknown;
  fingerprint: string | null;
  sourcePayload: unknown;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface ReconciliationSessionRecord {
  id: string;
  organizationId: string | null;
  entityId: string | null;
  bankAccountId: string;
  periodStart: string;
  periodEnd: string;
  statementEndingBalance: number | null;
  ledgerEndingBalance: number | null;
  status: string;
  readinessScore: number;
  closedBy: string | null;
  closedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface ReconciliationItemRecord {
  id: string;
  organizationId: string | null;
  sessionId: string;
  transactionId: string | null;
  matchType: string | null;
  status: string;
  variance: number;
  note: string | null;
  resolvedBy: string | null;
  resolvedAt: string | null;
  createdAt: string | null;
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
