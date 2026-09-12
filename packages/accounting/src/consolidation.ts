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
