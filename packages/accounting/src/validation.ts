import type { JournalLineInput, JournalValidationResult } from './types';

function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function validateJournalLines(lines: readonly JournalLineInput[]): JournalValidationResult {
  const errors: string[] = [];

  if (lines.length < 2) {
    errors.push('A journal entry requires at least two lines.');
  }

  for (const line of lines) {
    if (!line.accountId.trim()) {
      errors.push('Each journal line requires an account.');
    }

    if (!Number.isFinite(line.debit) || !Number.isFinite(line.credit)) {
      errors.push('Journal amounts must be finite numbers.');
      continue;
    }

    if (line.debit < 0 || line.credit < 0) {
      errors.push('Journal amounts cannot be negative.');
    }

    if (line.debit > 0 && line.credit > 0) {
      errors.push('Each journal line must contain either a debit or a credit, not both.');
    } else if (line.debit === 0 && line.credit === 0) {
      errors.push('Each journal line must contain a debit or a credit amount greater than zero.');
    }
  }

  const totalDebit = roundCurrency(
    lines.reduce((sum, line) => sum + (Number.isFinite(line.debit) ? line.debit : 0), 0),
  );
  const totalCredit = roundCurrency(
    lines.reduce((sum, line) => sum + (Number.isFinite(line.credit) ? line.credit : 0), 0),
  );

  if (totalDebit !== totalCredit) {
    errors.push('Journal debits and credits must balance.');
  }

  return {
    valid: errors.length === 0,
    errors: [...new Set(errors)],
    totalDebit,
    totalCredit,
  };
}
