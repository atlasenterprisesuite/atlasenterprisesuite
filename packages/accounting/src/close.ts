import type { JournalRecord, ReconciliationSessionRecord } from './types';

export interface PeriodCloseAssessmentInput {
  periodStart: string;
  periodEnd: string;
  journals: readonly JournalRecord[];
  reconciliations: readonly ReconciliationSessionRecord[];
  arReviewed: boolean;
  apReviewed: boolean;
  hasClosePermission: boolean;
}

export interface PeriodCloseAssessment {
  canClose: boolean;
  blockers: string[];
  checks: {
    journalsPosted: boolean;
    reconciliationsComplete: boolean;
    arReviewed: boolean;
    apReviewed: boolean;
    authorized: boolean;
  };
}

function assertDateRange(start: string, end: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
    throw new Error('Period dates must use YYYY-MM-DD');
  }
  if (start > end) throw new Error('Period end must be on or after period start');
}

function overlaps(startA: string, endA: string, startB: string, endB: string): boolean {
  return startA <= endB && startB <= endA;
}

export function assessPeriodClose(input: PeriodCloseAssessmentInput): PeriodCloseAssessment {
  assertDateRange(input.periodStart, input.periodEnd);

  const inPeriodJournals = input.journals.filter((journal) =>
    Boolean(journal.entryDate)
    && journal.entryDate! >= input.periodStart
    && journal.entryDate! <= input.periodEnd,
  );
  const relevantReconciliations = input.reconciliations.filter((reconciliation) =>
    overlaps(input.periodStart, input.periodEnd, reconciliation.periodStart, reconciliation.periodEnd),
  );

  const journalsPosted = inPeriodJournals.every((journal) => journal.status === 'posted');
  const reconciliationsComplete = relevantReconciliations.every((reconciliation) =>
    reconciliation.status === 'reconciled' || reconciliation.status === 'locked',
  );

  const blockers: string[] = [];
  if (!journalsPosted) blockers.push('All in-period journals must be posted');
  if (!reconciliationsComplete) blockers.push('Required reconciliations must be completed');
  if (!input.arReviewed) blockers.push('Accounts Receivable review must be acknowledged');
  if (!input.apReviewed) blockers.push('Accounts Payable review must be acknowledged');
  if (!input.hasClosePermission) blockers.push('Accounting close permission is required');

  return {
    canClose: blockers.length === 0,
    blockers,
    checks: {
      journalsPosted,
      reconciliationsComplete,
      arReviewed: input.arReviewed,
      apReviewed: input.apReviewed,
      authorized: input.hasClosePermission,
    },
  };
}
