import { describe, expect, test, vi } from 'vitest';
import {
  BankCashWriteService,
  type BankCashWriteGateway,
} from '../../packages/accounting/src';

function gateway(): BankCashWriteGateway {
  return {
    startReconciliation: vi.fn(async () => 'session-1'),
    resolveReconciliationItem: vi.fn(async () => 'item-1'),
    closeReconciliation: vi.fn(async () => 'session-1'),
  };
}

describe('Bank & Cash write service', () => {
  test('starts a reconciliation only with valid period and finite balances', async () => {
    const writes = gateway();
    const service = new BankCashWriteService(writes);

    await expect(service.startReconciliation({
      organizationId: ' org-1 ',
      bankAccountId: ' bank-1 ',
      periodStart: '2026-08-01',
      periodEnd: '2026-08-31',
      statementEndingBalance: 1200,
      ledgerEndingBalance: 1200,
    })).resolves.toBe('session-1');

    expect(writes.startReconciliation).toHaveBeenCalledWith({
      organizationId: 'org-1',
      bankAccountId: 'bank-1',
      periodStart: '2026-08-01',
      periodEnd: '2026-08-31',
      statementEndingBalance: 1200,
      ledgerEndingBalance: 1200,
    });

    await expect(service.startReconciliation({
      organizationId: 'org-1', bankAccountId: 'bank-1', periodStart: '2026-09-02', periodEnd: '2026-09-01',
      statementEndingBalance: 0, ledgerEndingBalance: 0,
    })).rejects.toThrow('Reconciliation period end must be on or after period start');
  });

  test('resolves or excludes a reconciliation item using supported states only', async () => {
    const writes = gateway();
    const service = new BankCashWriteService(writes);

    await expect(service.resolveReconciliationItem({
      organizationId: 'org-1', itemId: 'item-1', status: 'resolved', matchType: 'matched', variance: 0, note: 'Matched to ledger',
    })).resolves.toBe('item-1');

    await expect(service.resolveReconciliationItem({
      organizationId: 'org-1', itemId: 'item-1', status: 'open' as 'resolved', matchType: 'matched', variance: 0, note: null,
    })).rejects.toThrow('Unsupported reconciliation item status');
  });

  test('delegates close requests without pretending the session is balanced client-side', async () => {
    const writes = gateway();
    const service = new BankCashWriteService(writes);

    await expect(service.closeReconciliation({ organizationId: 'org-1', sessionId: 'session-1' })).resolves.toBe('session-1');
    expect(writes.closeReconciliation).toHaveBeenCalledWith({ organizationId: 'org-1', sessionId: 'session-1' });
  });
});
