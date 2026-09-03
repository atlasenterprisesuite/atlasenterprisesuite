import type {
  AccountingAuditEvent,
  AccountingTable,
  AccountRecord,
  InvoiceRecord,
  JournalLineRecord,
  JournalRecord,
  PartyRecord,
  PaymentRecord,
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
  listAuditEvents(organizationId: string): Promise<AccountingAuditEvent[]>;
}

type AccountRow = {
  id: string;
  org_id: string | null;
  account_number: string;
  name: string;
  account_type: string;
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
      'id,org_id,account_number,name,account_type,created_at,updated_at',
      orgId,
    );

    return rows.map((row) => ({
      id: row.id,
      organizationId: row.org_id,
      accountNumber: row.account_number,
      name: row.name,
      accountType: row.account_type,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  async listJournals(organizationId: string): Promise<JournalRecord[]> {
    const orgId = requireOrganizationId(organizationId);
    const rows = await this.gateway.select<JournalRow>(
      'journal_entries',
      'id,org_id,entry_number,entry_date,memo,status,created_by,created_at,updated_at',
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
