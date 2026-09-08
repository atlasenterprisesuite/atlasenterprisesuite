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

describe('Bank & Cash repository', () => {
  test('reads bank accounts and transactions with explicit organization scope', async () => {
    const gateway = new RecordingGateway({
      accounting_bank_accounts: [{
        id: 'bank-1', org_id: 'org-1', entity_id: null, provider: 'manual',
        provider_account_ref: null, display_name: 'Operating Account', account_type: 'checking',
        currency: 'USD', mask: '4242', connection_state: 'connected', current_balance: 1250.5,
        balance_as_of: '2026-09-04T08:00:00Z', metadata: {}, created_at: '2026-09-01T00:00:00Z',
        updated_at: '2026-09-04T08:00:00Z',
      }],
      accounting_transactions: [{
        id: 'txn-1', org_id: 'org-1', entity_id: null, bank_account_id: 'bank-1', external_id: 'ext-1',
        posted_date: '2026-09-03', description: 'Deposit', merchant: null, amount: 500,
        currency: 'USD', suggested_account_id: null, final_account_id: null, confidence: null,
        status: 'needs_review', evidence_state: 'missing', review_reason: null, flag: null,
        dimension: {}, fingerprint: null, source_payload: {}, created_at: '2026-09-03T12:00:00Z',
        updated_at: '2026-09-03T12:00:00Z',
      }],
    });
    const repository = new AccountingRepositoryImpl(gateway);

    await expect(repository.listBankAccounts('org-1')).resolves.toEqual([
      expect.objectContaining({ id: 'bank-1', displayName: 'Operating Account', currentBalance: 1250.5 }),
    ]);
    await expect(repository.listBankTransactions('org-1')).resolves.toEqual([
      expect.objectContaining({ id: 'txn-1', bankAccountId: 'bank-1', amount: 500, status: 'needs_review' }),
    ]);

    expect(gateway.calls.map((call) => call.table)).toEqual([
      'accounting_bank_accounts',
      'accounting_transactions',
    ]);
    expect(gateway.calls.every((call) => call.organizationId === 'org-1')).toBe(true);
  });

  test('reads reconciliation sessions and items without fabricating rows', async () => {
    const gateway = new RecordingGateway({
      accounting_reconciliation_sessions: [{
        id: 'session-1', org_id: 'org-1', entity_id: null, bank_account_id: 'bank-1',
        period_start: '2026-08-01', period_end: '2026-08-31', statement_ending_balance: 1200,
        ledger_ending_balance: 1200, status: 'reconciled', readiness_score: 100,
        closed_by: 'user-1', closed_at: '2026-09-01T10:00:00Z', created_at: '2026-09-01T09:00:00Z',
        updated_at: '2026-09-01T10:00:00Z',
      }],
      accounting_reconciliation_items: [{
        id: 'item-1', org_id: 'org-1', session_id: 'session-1', transaction_id: 'txn-1',
        match_type: 'matched', status: 'resolved', variance: 0, note: null,
        resolved_by: 'user-1', resolved_at: '2026-09-01T10:00:00Z', created_at: '2026-09-01T09:00:00Z',
      }],
    });
    const repository = new AccountingRepositoryImpl(gateway);

    await expect(repository.listReconciliationSessions('org-1')).resolves.toEqual([
      expect.objectContaining({ id: 'session-1', status: 'reconciled', readinessScore: 100 }),
    ]);
    await expect(repository.listReconciliationItems('org-1')).resolves.toEqual([
      expect.objectContaining({ id: 'item-1', status: 'resolved', variance: 0 }),
    ]);
  });

  test('preserves true zero-row bank and reconciliation responses', async () => {
    const repository = new AccountingRepositoryImpl(new RecordingGateway());
    await expect(repository.listBankAccounts('org-1')).resolves.toEqual([]);
    await expect(repository.listBankTransactions('org-1')).resolves.toEqual([]);
    await expect(repository.listReconciliationSessions('org-1')).resolves.toEqual([]);
    await expect(repository.listReconciliationItems('org-1')).resolves.toEqual([]);
  });
});
