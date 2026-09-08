import { describe, expect, it } from 'vitest';
import {
  assessPeriodClose,
  type JournalRecord,
  type ReconciliationSessionRecord,
} from '../../packages/accounting/src';

function journal(status: string, entryDate = '2026-08-15'): JournalRecord {
  return {
    id: `j-${status}`,
    organizationId: 'org-1',
    entryNumber: `J-${status}`,
    entryDate,
    memo: null,
    status,
    createdBy: 'u1',
    createdAt: null,
    updatedAt: null,
    reversesJournalEntryId: null,
    lines: [],
  };
}

function reconciliation(status: string): ReconciliationSessionRecord {
  return {
    id: `r-${status}`,
    organizationId: 'org-1',
    entityId: null,
    bankAccountId: 'bank-1',
    periodStart: '2026-08-01',
    periodEnd: '2026-08-31',
    statementEndingBalance: 100,
    ledgerEndingBalance: 100,
    status,
    readinessScore: status === 'reconciled' ? 100 : 50,
    closedBy: null,
    closedAt: null,
    createdAt: null,
    updatedAt: null,
  };
}

describe('ATLAS Accounting period close', () => {
  it('blocks close when an in-period journal is not posted', () => {
    const result = assessPeriodClose({
      periodStart: '2026-08-01',
      periodEnd: '2026-08-31',
      journals: [journal('draft')],
      reconciliations: [reconciliation('reconciled')],
      arReviewed: true,
      apReviewed: true,
      hasClosePermission: true,
    });

    expect(result.canClose).toBe(false);
    expect(result.blockers).toContain('All in-period journals must be posted');
  });

  it('blocks close when reconciliation is incomplete or review acknowledgements are missing', () => {
    const result = assessPeriodClose({
      periodStart: '2026-08-01',
      periodEnd: '2026-08-31',
      journals: [journal('posted')],
      reconciliations: [reconciliation('in_review')],
      arReviewed: false,
      apReviewed: true,
      hasClosePermission: true,
    });

    expect(result.canClose).toBe(false);
    expect(result.blockers).toEqual(expect.arrayContaining([
      'Required reconciliations must be completed',
      'Accounts Receivable review must be acknowledged',
    ]));
  });

  it('allows close only when operational and permission gates are satisfied', () => {
    const result = assessPeriodClose({
      periodStart: '2026-08-01',
      periodEnd: '2026-08-31',
      journals: [journal('posted')],
      reconciliations: [reconciliation('reconciled')],
      arReviewed: true,
      apReviewed: true,
      hasClosePermission: true,
    });

    expect(result.canClose).toBe(true);
    expect(result.blockers).toEqual([]);
  });
});
