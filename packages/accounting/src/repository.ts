import type {
  AccountingAuditEvent,
  AccountingTable,
  AccountRecord,
  BankAccountRecord,
  BankTransactionRecord,
  BillRecord,
  InvoiceRecord,
  JournalLineRecord,
  JournalRecord,
  PartyRecord,
  PaymentRecord,
  ReconciliationItemRecord,
  ReconciliationSessionRecord,
} from './types';

export interface AccountingReadGateway {
  select<T>(table: AccountingTable, columns: string, organizationId: string): Promise<T[]>;
}

export interface AccountingRepository {
  listAccounts(organizationId: string): Promise<AccountRecord[]>;
  listJournals(organizationId: string): Promise<JournalRecord[]>;
  listCustomers(organizationId: string): Promise<PartyRecord[]>;
  listVendors(organizationId: string): Promise<PartyRecord[]>;
  listInvoices(organizationId: string): Promise<InvoiceRecord[]>;
  listPayments(organizationId: string): Promise<PaymentRecord[]>;
  listBills(organizationId: string): Promise<BillRecord[]>;
  listBankAccounts(organizationId: string): Promise<BankAccountRecord[]>;
  listBankTransactions(organizationId: string): Promise<BankTransactionRecord[]>;
  listReconciliationSessions(organizationId: string): Promise<ReconciliationSessionRecord[]>;
  listReconciliationItems(organizationId: string): Promise<ReconciliationItemRecord[]>;
  listAuditEvents(organizationId: string): Promise<AccountingAuditEvent[]>;
}

type AccountRow = {
  id: string;
  org_id: string | null;
  account_number: string;
  name: string;
  account_type: string;
  active: boolean;
  created_at: string | null;
  updated_at: string | null;
};

type JournalRow = {
  id: string;
  org_id: string | null;
  entry_number: string;
  entry_date: string | null;
  memo: string | null;
  status: string | null;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
  reverses_journal_entry_id: string | null;
};

type JournalLineRow = {
  id: string;
  org_id: string | null;
  journal_entry_id: string | null;
  account_id: string | null;
  debit: number | null;
  credit: number | null;
  created_at: string | null;
};

type PartyRow = {
  id: string;
  org_id: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  status: string | null;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type InvoiceRow = {
  id: string;
  org_id: string | null;
  customer_id: string | null;
  invoice_number: string;
  issue_date: string | null;
  due_date: string | null;
  total: number | null;
  balance_due: number | null;
  status: string | null;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type PaymentRow = {
  id: string;
  org_id: string | null;
  invoice_id: string | null;
  amount: number;
  payment_date: string | null;
  status: string | null;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type BillRow = {
  id: string;
  org_id: string | null;
  entity_id: string | null;
  vendor_id: string | null;
  bill_number: string;
  bill_date: string | null;
  due_date: string | null;
  amount: number;
  balance_due: number;
  approval_state: string;
  match_state: string;
  status: string;
  source_document_id: string | null;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type BankAccountRow = {
  id: string;
  org_id: string | null;
  entity_id: string | null;
  provider: string | null;
  provider_account_ref: string | null;
  display_name: string;
  account_type: string | null;
  currency: string;
  mask: string | null;
  connection_state: string;
  current_balance: number | null;
  balance_as_of: string | null;
  metadata: unknown;
  created_at: string | null;
  updated_at: string | null;
};

type BankTransactionRow = {
  id: string;
  org_id: string | null;
  entity_id: string | null;
  bank_account_id: string | null;
  external_id: string | null;
  posted_date: string;
  description: string;
  merchant: string | null;
  amount: number;
  currency: string;
  suggested_account_id: string | null;
  final_account_id: string | null;
  confidence: number | null;
  status: string;
  evidence_state: string;
  review_reason: string | null;
  flag: string | null;
  dimension: unknown;
  fingerprint: string | null;
  source_payload: unknown;
  created_at: string | null;
  updated_at: string | null;
};

type ReconciliationSessionRow = {
  id: string;
  org_id: string | null;
  entity_id: string | null;
  bank_account_id: string;
  period_start: string;
  period_end: string;
  statement_ending_balance: number | null;
  ledger_ending_balance: number | null;
  status: string;
  readiness_score: number;
  closed_by: string | null;
  closed_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type ReconciliationItemRow = {
  id: string;
  org_id: string | null;
  session_id: string;
  transaction_id: string | null;
  match_type: string | null;
  status: string;
  variance: number;
  note: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string | null;
};

type AuditRow = {
  id: number;
  org_id: string | null;
  user_id: string | null;
  action: string;
  table_name: string | null;
  record_id: string | null;
  old_data: unknown;
  new_data: unknown;
  created_at: string | null;
};

function requireOrganizationId(organizationId: string): string {
  const value = organizationId.trim();
  if (!value) throw new Error('organizationId is required');
  return value;
}

function mapParty(row: PartyRow): PartyRecord {
  return {
    id: row.id,
    organizationId: row.org_id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    status: row.status,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class AccountingRepositoryImpl implements AccountingRepository {
  constructor(private readonly gateway: AccountingReadGateway) {}

  async listAccounts(organizationId: string): Promise<AccountRecord[]> {
    const orgId = requireOrganizationId(organizationId);
    const rows = await this.gateway.select<AccountRow>(
      'chart_of_accounts',
      'id,org_id,account_number,name,account_type,active,created_at,updated_at',
      orgId,
    );

    return rows.map((row) => ({
      id: row.id,
      organizationId: row.org_id,
      accountNumber: row.account_number,
      name: row.name,
      accountType: row.account_type,
      active: row.active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  async listJournals(organizationId: string): Promise<JournalRecord[]> {
    const orgId = requireOrganizationId(organizationId);
    const rows = await this.gateway.select<JournalRow>(
      'journal_entries',
      'id,org_id,entry_number,entry_date,memo,status,created_by,created_at,updated_at,reverses_journal_entry_id',
      orgId,
    );
    const lineRows = await this.gateway.select<JournalLineRow>(
      'journal_lines',
      'id,org_id,journal_entry_id,account_id,debit,credit,created_at',
      orgId,
    );

    const linesByJournal = new Map<string, JournalLineRecord[]>();
    for (const row of lineRows) {
      if (!row.journal_entry_id) continue;
      const lines = linesByJournal.get(row.journal_entry_id) ?? [];
      lines.push({
        id: row.id,
        organizationId: row.org_id,
        journalEntryId: row.journal_entry_id,
        accountId: row.account_id,
        debit: row.debit,
        credit: row.credit,
        createdAt: row.created_at,
      });
      linesByJournal.set(row.journal_entry_id, lines);
    }

    return rows.map((row) => ({
      id: row.id,
      organizationId: row.org_id,
      entryNumber: row.entry_number,
      entryDate: row.entry_date,
      memo: row.memo,
      status: row.status,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      reversesJournalEntryId: row.reverses_journal_entry_id,
      lines: linesByJournal.get(row.id) ?? [],
    }));
  }

  async listCustomers(organizationId: string): Promise<PartyRecord[]> {
    const orgId = requireOrganizationId(organizationId);
    const rows = await this.gateway.select<PartyRow>(
      'customers',
      'id,org_id,name,email,phone,status,created_by,created_at,updated_at',
      orgId,
    );
    return rows.map(mapParty);
  }

  async listVendors(organizationId: string): Promise<PartyRecord[]> {
    const orgId = requireOrganizationId(organizationId);
    const rows = await this.gateway.select<PartyRow>(
      'vendors',
      'id,org_id,name,email,phone,status,created_by,created_at,updated_at',
      orgId,
    );
    return rows.map(mapParty);
  }

  async listInvoices(organizationId: string): Promise<InvoiceRecord[]> {
    const orgId = requireOrganizationId(organizationId);
    const rows = await this.gateway.select<InvoiceRow>(
      'invoices',
      'id,org_id,customer_id,invoice_number,issue_date,due_date,total,balance_due,status,created_by,created_at,updated_at',
      orgId,
    );

    return rows.map((row) => ({
      id: row.id,
      organizationId: row.org_id,
      customerId: row.customer_id,
      invoiceNumber: row.invoice_number,
      issueDate: row.issue_date,
      dueDate: row.due_date,
      total: row.total,
      balanceDue: row.balance_due,
      status: row.status,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  async listPayments(organizationId: string): Promise<PaymentRecord[]> {
    const orgId = requireOrganizationId(organizationId);
    const rows = await this.gateway.select<PaymentRow>(
      'payments',
      'id,org_id,invoice_id,amount,payment_date,status,created_by,created_at,updated_at',
      orgId,
    );

    return rows.map((row) => ({
      id: row.id,
      organizationId: row.org_id,
      invoiceId: row.invoice_id,
      amount: row.amount,
      paymentDate: row.payment_date,
      status: row.status,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  async listBills(organizationId: string): Promise<BillRecord[]> {
    const orgId = requireOrganizationId(organizationId);
    const rows = await this.gateway.select<BillRow>(
      'accounting_bills',
      'id,org_id,entity_id,vendor_id,bill_number,bill_date,due_date,amount,balance_due,approval_state,match_state,status,source_document_id,created_by,created_at,updated_at',
      orgId,
    );

    return rows.map((row) => ({
      id: row.id,
      organizationId: row.org_id,
      entityId: row.entity_id,
      vendorId: row.vendor_id,
      billNumber: row.bill_number,
      billDate: row.bill_date,
      dueDate: row.due_date,
      amount: row.amount,
      balanceDue: row.balance_due,
      approvalState: row.approval_state,
      matchState: row.match_state,
      status: row.status,
      sourceDocumentId: row.source_document_id,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  async listBankAccounts(organizationId: string): Promise<BankAccountRecord[]> {
    const orgId = requireOrganizationId(organizationId);
    const rows = await this.gateway.select<BankAccountRow>(
      'accounting_bank_accounts',
      'id,org_id,entity_id,provider,provider_account_ref,display_name,account_type,currency,mask,connection_state,current_balance,balance_as_of,metadata,created_at,updated_at',
      orgId,
    );

    return rows.map((row) => ({
      id: row.id,
      organizationId: row.org_id,
      entityId: row.entity_id,
      provider: row.provider,
      providerAccountRef: row.provider_account_ref,
      displayName: row.display_name,
      accountType: row.account_type,
      currency: row.currency,
      mask: row.mask,
      connectionState: row.connection_state,
      currentBalance: row.current_balance,
      balanceAsOf: row.balance_as_of,
      metadata: row.metadata,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  async listBankTransactions(organizationId: string): Promise<BankTransactionRecord[]> {
    const orgId = requireOrganizationId(organizationId);
    const rows = await this.gateway.select<BankTransactionRow>(
      'accounting_transactions',
      'id,org_id,entity_id,bank_account_id,external_id,posted_date,description,merchant,amount,currency,suggested_account_id,final_account_id,confidence,status,evidence_state,review_reason,flag,dimension,fingerprint,source_payload,created_at,updated_at',
      orgId,
    );

    return rows.map((row) => ({
      id: row.id,
      organizationId: row.org_id,
      entityId: row.entity_id,
      bankAccountId: row.bank_account_id,
      externalId: row.external_id,
      postedDate: row.posted_date,
      description: row.description,
      merchant: row.merchant,
      amount: row.amount,
      currency: row.currency,
      suggestedAccountId: row.suggested_account_id,
      finalAccountId: row.final_account_id,
      confidence: row.confidence,
      status: row.status,
      evidenceState: row.evidence_state,
      reviewReason: row.review_reason,
      flag: row.flag,
      dimension: row.dimension,
      fingerprint: row.fingerprint,
      sourcePayload: row.source_payload,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  async listReconciliationSessions(organizationId: string): Promise<ReconciliationSessionRecord[]> {
    const orgId = requireOrganizationId(organizationId);
    const rows = await this.gateway.select<ReconciliationSessionRow>(
      'accounting_reconciliation_sessions',
      'id,org_id,entity_id,bank_account_id,period_start,period_end,statement_ending_balance,ledger_ending_balance,status,readiness_score,closed_by,closed_at,created_at,updated_at',
      orgId,
    );

    return rows.map((row) => ({
      id: row.id,
      organizationId: row.org_id,
      entityId: row.entity_id,
      bankAccountId: row.bank_account_id,
      periodStart: row.period_start,
      periodEnd: row.period_end,
      statementEndingBalance: row.statement_ending_balance,
      ledgerEndingBalance: row.ledger_ending_balance,
      status: row.status,
      readinessScore: row.readiness_score,
      closedBy: row.closed_by,
      closedAt: row.closed_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  async listReconciliationItems(organizationId: string): Promise<ReconciliationItemRecord[]> {
    const orgId = requireOrganizationId(organizationId);
    const rows = await this.gateway.select<ReconciliationItemRow>(
      'accounting_reconciliation_items',
      'id,org_id,session_id,transaction_id,match_type,status,variance,note,resolved_by,resolved_at,created_at',
      orgId,
    );

    return rows.map((row) => ({
      id: row.id,
      organizationId: row.org_id,
      sessionId: row.session_id,
      transactionId: row.transaction_id,
      matchType: row.match_type,
      status: row.status,
      variance: row.variance,
      note: row.note,
      resolvedBy: row.resolved_by,
      resolvedAt: row.resolved_at,
      createdAt: row.created_at,
    }));
  }

  async listAuditEvents(organizationId: string): Promise<AccountingAuditEvent[]> {
    const orgId = requireOrganizationId(organizationId);
    const rows = await this.gateway.select<AuditRow>(
      'audit_logs',
      'id,org_id,user_id,action,table_name,record_id,old_data,new_data,created_at',
      orgId,
    );

    return rows.map((row) => ({
      id: row.id,
      organizationId: row.org_id,
      userId: row.user_id,
      action: row.action,
      tableName: row.table_name,
      recordId: row.record_id,
      oldData: row.old_data,
      newData: row.new_data,
      createdAt: row.created_at,
    }));
  }
}
