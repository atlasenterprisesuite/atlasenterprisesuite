import type { AccountRecord, JournalRecord } from './types';

export type GeneralLedgerRow = {
  journalId: string;
  journalLineId: string;
  entryNumber: string;
  entryDate: string | null;
  memo: string | null;
  accountId: string | null;
  accountNumber: string | null;
  accountName: string | null;
  accountType: string | null;
  debit: number;
  credit: number;
  runningNet: number;
};

function sortableDate(value: string | null): string {
  return value ?? '';
}

export function buildGeneralLedger(
  accounts: readonly AccountRecord[],
  journals: readonly JournalRecord[],
): GeneralLedgerRow[] {
  const accountsById = new Map(accounts.map((account) => [account.id, account]));
  const runningByAccount = new Map<string, number>();

  const sourceRows = journals
    .filter((journal) => journal.status === 'posted')
    .flatMap((journal) =>
      journal.lines.map((line) => ({
        journal,
        line,
      })),
    )
    .sort((a, b) => {
      const byDate = sortableDate(a.journal.entryDate).localeCompare(sortableDate(b.journal.entryDate));
      if (byDate !== 0) return byDate;
      const byEntryNumber = a.journal.entryNumber.localeCompare(b.journal.entryNumber);
      if (byEntryNumber !== 0) return byEntryNumber;
      return a.line.id.localeCompare(b.line.id);
    });

  return sourceRows.map(({ journal, line }) => {
    const accountId = line.accountId;
    const account = accountId ? accountsById.get(accountId) : undefined;
    const debit = Number(line.debit ?? 0);
    const credit = Number(line.credit ?? 0);
    const key = accountId ?? `unresolved:${line.id}`;
    const runningNet = (runningByAccount.get(key) ?? 0) + debit - credit;
    runningByAccount.set(key, runningNet);

    return {
      journalId: journal.id,
      journalLineId: line.id,
      entryNumber: journal.entryNumber,
      entryDate: journal.entryDate,
      memo: journal.memo,
      accountId,
      accountNumber: account?.accountNumber ?? null,
      accountName: account?.name ?? null,
      accountType: account?.accountType ?? null,
      debit,
      credit,
      runningNet,
    };
  });
}
