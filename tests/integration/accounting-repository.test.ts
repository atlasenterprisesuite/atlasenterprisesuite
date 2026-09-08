import { describe, expect, test } from 'vitest';
import {
  AccountingRepositoryImpl,
  type AccountingReadGateway,
  type AccountingTable,
} from '../../packages/accounting/src';

class RecordingGateway implements AccountingReadGateway {
  readonly calls: Array<{ table: AccountingTable; columns: string; organizationId: string }> = [];

  constructor(private readonly rows: Partial<Record<AccountingTable, unknown[]>> = {}) {}

  async select<T>(table: AccountingTable, columns: string, organizationId: string): Promise<T[]> {
    this.calls.push({ table, columns, organizationId });
    return (this.rows[table] ?? []) as T[];
  }
}

describe('AccountingRepositoryImpl', () => {
  test('reads only the canonical accounting tables with explicit organization scope', async () => {
    const gateway = new RecordingGateway();
    const repository = new AccountingRepositoryImpl(gateway);

    await repository.listAccounts('org-test');
    await repository.listJournals('org-test');
    await repository.listCustomers('org-test');
    await repository.listVendors('org-test');
    await repository.listInvoices('org-test');
    await repository.listPayments('org-test');
    await repository.listAuditEvents('org-test');

    expect(gateway.calls.map(({ table }) => table)).toEqual([
      'chart_of_accounts',
      'journal_entries',
      'journal_lines',
      'customers',
      'vendors',
      'invoices',
      'payments',
      'audit_logs',
    ]);
    expect(gateway.calls.every(({ organizationId }) => organizationId === 'org-test')).toBe(true);
  });

  test('preserves true zero-row responses instead of inserting fallback data', async () => {
    const repository = new AccountingRepositoryImpl(new RecordingGateway());

    await expect(repository.listAccounts('org-test')).resolves.toEqual([]);
    await expect(repository.listJournals('org-test')).resolves.toEqual([]);
    await expect(repository.listInvoices('org-test')).resolves.toEqual([]);
  });

  test('maps canonical database columns without fabricating values', async () => {
    const gateway = new RecordingGateway({
      chart_of_accounts: [
        {
          id: 'account-id',
          org_id: 'org-test',
          account_number: '1000',
          name: 'Cash',
          account_type: 'asset',
          active: true,
          created_at: '2026-09-03T00:00:00Z',
          updated_at: '2026-09-03T00:00:00Z',
        },
      ],
    });
    const repository = new AccountingRepositoryImpl(gateway);

    await expect(repository.listAccounts('org-test')).resolves.toEqual([
      {
        id: 'account-id',
        organizationId: 'org-test',
        accountNumber: '1000',
        name: 'Cash',
        accountType: 'asset',
        active: true,
        createdAt: '2026-09-03T00:00:00Z',
        updatedAt: '2026-09-03T00:00:00Z',
      },
    ]);
    expect(gateway.calls[0]?.columns).toContain('active');
  });

  test('preserves journal reversal linkage from the canonical column', async () => {
    const gateway = new RecordingGateway({
      journal_entries: [
        {
          id: 'journal-reversal',
          org_id: 'org-test',
          entry_number: 'JE-1001-R1',
          entry_date: '2026-09-03',
          memo: 'Reversal',
          status: 'posted',
          created_by: 'user-1',
          created_at: '2026-09-03T00:00:00Z',
          updated_at: '2026-09-03T00:00:00Z',
          reverses_journal_entry_id: 'journal-original',
        },
      ],
      journal_lines: [],
    });
    const repository = new AccountingRepositoryImpl(gateway);

    const journals = await repository.listJournals('org-test');

    expect(journals[0]?.reversesJournalEntryId).toBe('journal-original');
    expect(gateway.calls[0]?.columns).toContain('reverses_journal_entry_id');
  });

  test('rejects an empty organization scope before a query can run', async () => {
    const gateway = new RecordingGateway();
    const repository = new AccountingRepositoryImpl(gateway);

    await expect(repository.listAccounts('   ')).rejects.toThrow('organizationId is required');
    expect(gateway.calls).toEqual([]);
  });
});
