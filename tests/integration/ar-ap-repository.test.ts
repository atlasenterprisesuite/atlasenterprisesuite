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

describe('AR/AP repository', () => {
  test('reads canonical accounting bills with explicit organization scope', async () => {
    const gateway = new RecordingGateway({
      accounting_bills: [
        {
          id: 'bill-1',
          org_id: 'org-test',
          entity_id: null,
          vendor_id: 'vendor-1',
          bill_number: 'BILL-1001',
          bill_date: '2026-08-20',
          due_date: null,
          amount: 58.98,
          balance_due: 58.98,
          approval_state: 'pending',
          match_state: 'no_po',
          status: 'open',
          source_document_id: null,
          created_by: 'user-1',
          created_at: '2026-08-20T12:00:00Z',
          updated_at: '2026-08-20T12:00:00Z',
        },
      ],
    });
    const repository = new AccountingRepositoryImpl(gateway);

    await expect(repository.listBills('org-test')).resolves.toEqual([
      {
        id: 'bill-1',
        organizationId: 'org-test',
        entityId: null,
        vendorId: 'vendor-1',
        billNumber: 'BILL-1001',
        billDate: '2026-08-20',
        dueDate: null,
        amount: 58.98,
        balanceDue: 58.98,
        approvalState: 'pending',
        matchState: 'no_po',
        status: 'open',
        sourceDocumentId: null,
        createdBy: 'user-1',
        createdAt: '2026-08-20T12:00:00Z',
        updatedAt: '2026-08-20T12:00:00Z',
      },
    ]);

    expect(gateway.calls).toHaveLength(1);
    expect(gateway.calls[0]?.table).toBe('accounting_bills');
    expect(gateway.calls[0]?.organizationId).toBe('org-test');
    expect(gateway.calls[0]?.columns).toContain('approval_state');
    expect(gateway.calls[0]?.columns).toContain('match_state');
  });

  test('preserves a true zero-row bills response', async () => {
    const repository = new AccountingRepositoryImpl(new RecordingGateway());
    await expect(repository.listBills('org-test')).resolves.toEqual([]);
  });
});
