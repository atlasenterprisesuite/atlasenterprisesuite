export type EntityReportingBalance = {
  entityId: string;
  accountId: string;
  debit: number;
  credit: number;
  consolidationWeight: number;
};

export type ConsolidationAdjustmentLine = {
  accountId: string;
  debit: number;
  credit: number;
};

export type ConsolidatedReportingBalance = {
  accountId: string;
  debit: number;
  credit: number;
  balance: number;
};

export type ConsolidationGroupRow = {
  id: string;
  org_id: string;
  parent_entity_id: string | null;
  name: string;
  reporting_currency: string;
  status: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ConsolidationGroupRecord = {
  id: string;
  organizationId: string;
  parentEntityId: string | null;
  name: string;
  reportingCurrency: string;
  status: string;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ConsolidationMemberRow = {
  id: string;
  org_id: string;
  group_id: string;
  entity_id: string;
  consolidation_method: 'full' | 'proportional';
  ownership_pct: number;
  effective_from: string;
  effective_to: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ConsolidationMemberRecord = {
  id: string;
  organizationId: string;
  groupId: string;
  entityId: string;
  consolidationMethod: 'full' | 'proportional';
  ownershipPct: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type IntercompanyMatchRow = {
  id: string;
  org_id: string;
  group_id: string;
  match_reference: string;
  source_line_id: string;
  counterparty_line_id: string;
  source_entity_id: string;
  counterparty_entity_id: string;
  reporting_currency: string;
  source_reporting_amount: number;
  counterparty_reporting_amount: number;
  difference: number;
  tolerance: number;
  status: 'matched' | 'exception' | 'eliminated';
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type IntercompanyMatchRecord = {
  id: string;
  organizationId: string;
  groupId: string;
  matchReference: string;
  sourceLineId: string;
  counterpartyLineId: string;
  sourceEntityId: string;
  counterpartyEntityId: string;
  reportingCurrency: string;
  sourceReportingAmount: number;
  counterpartyReportingAmount: number;
  difference: number;
  tolerance: number;
  status: 'matched' | 'exception' | 'eliminated';
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ConsolidationAdjustmentRow = {
  id: string;
  org_id: string;
  group_id: string;
  source_match_id: string | null;
  adjustment_date: string;
  reference: string;
  reason: string;
  status: 'draft' | 'posted' | 'locked';
  created_by: string | null;
  posted_by: string | null;
  posted_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ConsolidationAdjustmentRecord = {
  id: string;
  organizationId: string;
  groupId: string;
  sourceMatchId: string | null;
  adjustmentDate: string;
  reference: string;
  reason: string;
  status: 'draft' | 'posted' | 'locked';
  createdBy: string | null;
  postedBy: string | null;
  postedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type IntercompanyCandidateRow = {
  line_id: string;
  journal_id: string;
  entry_number: string;
  entry_date: string;
  entity_id: string;
  entity_code: string;
  entity_name: string;
  account_id: string;
  account_number: string;
  account_name: string;
  debit: number;
  credit: number;
  functional_currency: string;
  reporting_currency: string;
  reporting_amount: number;
  latest_match_id: string | null;
  latest_match_reference: string | null;
  latest_match_status: string | null;
};

export type IntercompanyCandidateRecord = {
  lineId: string;
  journalId: string;
  entryNumber: string;
  entryDate: string;
  entityId: string;
  entityCode: string;
  entityName: string;
  accountId: string;
  accountNumber: string;
  accountName: string;
  debit: number;
  credit: number;
  functionalCurrency: string;
  reportingCurrency: string;
  reportingAmount: number;
  latestMatchId: string | null;
  latestMatchReference: string | null;
  latestMatchStatus: string | null;
};

export type ConsolidatedTrialBalanceRow = {
  account_id: string;
  account_number: string;
  account_name: string;
  debit: number;
  credit: number;
  balance: number;
  reporting_currency: string;
};

export function mapConsolidationGroup(row: ConsolidationGroupRow): ConsolidationGroupRecord {
  return {
    id: row.id,
    organizationId: row.org_id,
    parentEntityId: row.parent_entity_id,
    name: row.name,
    reportingCurrency: row.reporting_currency,
    status: row.status,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapConsolidationMember(row: ConsolidationMemberRow): ConsolidationMemberRecord {
  return {
    id: row.id,
    organizationId: row.org_id,
    groupId: row.group_id,
    entityId: row.entity_id,
    consolidationMethod: row.consolidation_method,
    ownershipPct: Number(row.ownership_pct),
    effectiveFrom: row.effective_from,
    effectiveTo: row.effective_to,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapIntercompanyMatch(row: IntercompanyMatchRow): IntercompanyMatchRecord {
  return {
    id: row.id,
    organizationId: row.org_id,
    groupId: row.group_id,
    matchReference: row.match_reference,
    sourceLineId: row.source_line_id,
    counterpartyLineId: row.counterparty_line_id,
    sourceEntityId: row.source_entity_id,
    counterpartyEntityId: row.counterparty_entity_id,
    reportingCurrency: row.reporting_currency,
    sourceReportingAmount: Number(row.source_reporting_amount),
    counterpartyReportingAmount: Number(row.counterparty_reporting_amount),
    difference: Number(row.difference),
    tolerance: Number(row.tolerance),
    status: row.status,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapConsolidationAdjustment(row: ConsolidationAdjustmentRow): ConsolidationAdjustmentRecord {
  return {
    id: row.id,
    organizationId: row.org_id,
    groupId: row.group_id,
    sourceMatchId: row.source_match_id,
    adjustmentDate: row.adjustment_date,
    reference: row.reference,
    reason: row.reason,
    status: row.status,
    createdBy: row.created_by,
    postedBy: row.posted_by,
    postedAt: row.posted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapIntercompanyCandidate(row: IntercompanyCandidateRow): IntercompanyCandidateRecord {
  return {
    lineId: row.line_id,
    journalId: row.journal_id,
    entryNumber: row.entry_number,
    entryDate: row.entry_date,
    entityId: row.entity_id,
    entityCode: row.entity_code,
    entityName: row.entity_name,
    accountId: row.account_id,
    accountNumber: row.account_number,
    accountName: row.account_name,
    debit: Number(row.debit),
    credit: Number(row.credit),
    functionalCurrency: row.functional_currency,
    reportingCurrency: row.reporting_currency,
    reportingAmount: Number(row.reporting_amount),
    latestMatchId: row.latest_match_id,
    latestMatchReference: row.latest_match_reference,
    latestMatchStatus: row.latest_match_status,
  };
}

function cents(value: number, label: string) {
  const normalized = Number(value);
  if (!Number.isFinite(normalized)) throw new Error(`${label} must be finite`);
  return Math.round(normalized * 100);
}

function amount(valueInCents: number) {
  return valueInCents / 100;
}

function validateSide(debit: number, credit: number) {
  const debitCents = cents(debit, 'Debit');
  const creditCents = cents(credit, 'Credit');
  if (debitCents < 0 || creditCents < 0) throw new Error('Debit and credit must be nonnegative');
  if (debitCents > 0 && creditCents > 0) throw new Error('A consolidation line cannot contain both debit and credit');
  return { debitCents, creditCents };
}

export function intercompanyDifference(leftReportingAmount: number, rightReportingAmount: number) {
  return amount(Math.abs(cents(leftReportingAmount, 'Left reporting amount') - cents(rightReportingAmount, 'Right reporting amount')));
}

export function consolidateReportingBalances(
  entityBalances: readonly EntityReportingBalance[],
  adjustments: readonly ConsolidationAdjustmentLine[],
): ConsolidatedReportingBalance[] {
  const byAccount = new Map<string, { debit: number; credit: number }>();

  for (const row of entityBalances) {
    const weight = Number(row.consolidationWeight);
    if (!Number.isFinite(weight) || weight < 0 || weight > 1) {
      throw new Error('Consolidation weight must be between 0 and 1');
    }
    const { debitCents, creditCents } = validateSide(row.debit, row.credit);
    const current = byAccount.get(row.accountId) ?? { debit: 0, credit: 0 };
    current.debit += Math.round(debitCents * weight);
    current.credit += Math.round(creditCents * weight);
    byAccount.set(row.accountId, current);
  }

  for (const row of adjustments) {
    const { debitCents, creditCents } = validateSide(row.debit, row.credit);
    const current = byAccount.get(row.accountId) ?? { debit: 0, credit: 0 };
    current.debit += debitCents;
    current.credit += creditCents;
    byAccount.set(row.accountId, current);
  }

  return [...byAccount.entries()]
    .map(([accountId, values]) => ({
      accountId,
      debit: amount(values.debit),
      credit: amount(values.credit),
      balance: amount(values.debit - values.credit),
    }))
    .sort((a, b) => a.accountId.localeCompare(b.accountId));
}
