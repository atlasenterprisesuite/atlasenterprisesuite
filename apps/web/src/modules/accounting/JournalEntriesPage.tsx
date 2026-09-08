import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react';
import { hasPermission } from '../../../../../packages/core/src';
import type {
  AccountRecord,
  JournalRecord,
} from '../../../../../packages/accounting/src';
import { useAtlasContext } from '../../app/AtlasContext';
import { useAccountingRepository } from './AccountingDataProvider';
import { useAccountingWriteService } from './AccountingWriteProvider';

type JournalDataState =
  | { status: 'waiting' | 'loading' }
  | { status: 'connection_unavailable' }
  | { status: 'error' }
  | { status: 'ready'; accounts: AccountRecord[]; journals: JournalRecord[] };

type ActionState =
  | { status: 'idle' }
  | { status: 'working' }
  | { status: 'success'; message: string; id: string }
  | { status: 'error'; message: string };

export function JournalEntriesPage() {
  const identity = useAtlasContext();
  const repository = useAccountingRepository();
  const writeService = useAccountingWriteService();
  const [dataState, setDataState] = useState<JournalDataState>({ status: 'waiting' });
  const [actionState, setActionState] = useState<ActionState>({ status: 'idle' });

  const [entryNumber, setEntryNumber] = useState('');
  const [entryDate, setEntryDate] = useState('');
  const [memo, setMemo] = useState('');
  const [debitAccountId, setDebitAccountId] = useState('');
  const [creditAccountId, setCreditAccountId] = useState('');
  const [amount, setAmount] = useState('');

  const [reversalJournalId, setReversalJournalId] = useState<string | null>(null);
  const [reversalEntryNumber, setReversalEntryNumber] = useState('');
  const [reversalDate, setReversalDate] = useState('');
  const [reversalReason, setReversalReason] = useState('');

  const load = useCallback(async () => {
    if (identity.status !== 'ready') {
      setDataState({ status: 'waiting' });
      return;
    }

    if (!repository) {
      setDataState({ status: 'connection_unavailable' });
      return;
    }

    setDataState({ status: 'loading' });
    try {
      const [accounts, journals] = await Promise.all([
        repository.listAccounts(identity.organizationId),
        repository.listJournals(identity.organizationId),
      ]);
      setDataState({ status: 'ready', accounts, journals });
    } catch {
      setDataState({ status: 'error' });
    }
  }, [identity, repository]);

  useEffect(() => {
    void load();
  }, [load]);

  const canPost =
    identity.status === 'ready' && hasPermission(identity.permissions, 'accounting.post');

  const reversedJournalIds = useMemo(() => {
    if (dataState.status !== 'ready') return new Set<string>();
    return new Set(
      dataState.journals
        .map((journal) => journal.reversesJournalEntryId)
        .filter((id): id is string => Boolean(id)),
    );
  }, [dataState]);

  async function submitJournal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (identity.status !== 'ready' || !writeService || !canPost) return;

    setActionState({ status: 'working' });
    try {
      const id = await writeService.createPostedJournal({
        organizationId: identity.organizationId,
        entryNumber,
        entryDate: entryDate || null,
        memo: memo.trim() ? memo : null,
        debitAccountId,
        creditAccountId,
        amount: Number(amount),
      });
      setActionState({ status: 'success', message: 'Journal posted', id });
      setEntryNumber('');
      setEntryDate('');
      setMemo('');
      setDebitAccountId('');
      setCreditAccountId('');
      setAmount('');
      await load();
    } catch (error) {
      setActionState({
        status: 'error',
        message: error instanceof Error ? error.message : 'Journal posting failed',
      });
    }
  }

  async function submitReversal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      identity.status !== 'ready' ||
      !writeService ||
      !canPost ||
      !reversalJournalId
    ) {
      return;
    }

    setActionState({ status: 'working' });
    try {
      const id = await writeService.reversePostedJournal({
        organizationId: identity.organizationId,
        journalEntryId: reversalJournalId,
        reversalEntryNumber,
        reversalDate: reversalDate || null,
        reason: reversalReason,
      });
      setActionState({ status: 'success', message: 'Reversal posted', id });
      setReversalJournalId(null);
      setReversalEntryNumber('');
      setReversalDate('');
      setReversalReason('');
      await load();
    } catch (error) {
      setActionState({
        status: 'error',
        message: error instanceof Error ? error.message : 'Journal reversal failed',
      });
    }
  }

  return (
    <main className="atlas-page atlas-module-page">
      <p className="atlas-eyebrow">ATLAS Finance / Accounting</p>
      <h1>Journal Entries</h1>
      <p className="atlas-page__lede">
        Posted entries are governed by organization membership, Accounting roles, database RLS,
        double-entry validation, immutability guards, and audited reversal workflows.
      </p>

      {(dataState.status === 'waiting' || dataState.status === 'loading') && (
        <section className="atlas-status-panel" role="status">
          <strong>Loading journal entries</strong>
          <span>Reading the authorized organization ledger.</span>
        </section>
      )}

      {dataState.status === 'connection_unavailable' && (
        <section className="atlas-status-panel" role="status">
          <strong>Journal data connection unavailable</strong>
          <span>No configured real Accounting repository is available.</span>
        </section>
      )}

      {dataState.status === 'error' && (
        <section className="atlas-status-panel atlas-status-panel--degraded" role="status">
          <strong>Journal data unavailable</strong>
          <span>The authorized ledger query did not complete successfully.</span>
        </section>
      )}

      {dataState.status === 'ready' && (
        <>
          <section className="atlas-status-panel" aria-label="Available chart of accounts">
            <strong>Available accounts</strong>
            {dataState.accounts.length === 0 ? (
              <span>No chart of accounts records are available for this organization.</span>
            ) : (
              <ul>
                {dataState.accounts.map((account) => (
                  <li key={account.id}>{account.accountNumber} · {account.name}</li>
                ))}
              </ul>
            )}
          </section>

          {canPost && !writeService && (
            <section className="atlas-status-panel atlas-status-panel--degraded" role="status">
              <strong>Journal posting unavailable</strong>
              <span>The real Accounting write service is not configured for this runtime.</span>
            </section>
          )}

          {canPost && writeService && (
            <section className="atlas-status-panel" aria-label="Post journal entry">
              <strong>Post balanced journal entry</strong>
              <form onSubmit={submitJournal} className="atlas-form">
                <label>
                  Entry number
                  <input value={entryNumber} onChange={(event) => setEntryNumber(event.target.value)} required />
                </label>
                <label>
                  Entry date
                  <input type="date" value={entryDate} onChange={(event) => setEntryDate(event.target.value)} />
                </label>
                <label>
                  Memo
                  <input value={memo} onChange={(event) => setMemo(event.target.value)} />
                </label>
                <label>
                  Debit account
                  <select value={debitAccountId} onChange={(event) => setDebitAccountId(event.target.value)} required>
                    <option value="">Select account</option>
                    {dataState.accounts.map((account) => (
                      <option key={account.id} value={account.id}>{account.accountNumber} · {account.name}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Credit account
                  <select value={creditAccountId} onChange={(event) => setCreditAccountId(event.target.value)} required>
                    <option value="">Select account</option>
                    {dataState.accounts.map((account) => (
                      <option key={account.id} value={account.id}>{account.accountNumber} · {account.name}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Amount
                  <input type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} required />
                </label>
                <button type="submit" disabled={actionState.status === 'working'}>Post journal entry</button>
              </form>
            </section>
          )}

          <section className="atlas-status-panel" aria-label="Journal entries list">
            <strong>Posted and draft journals</strong>
            {dataState.journals.length === 0 ? (
              <span>No journal entries are recorded for this organization.</span>
            ) : (
              <ul>
                {dataState.journals.map((journal) => {
                  const original = journal.reversesJournalEntryId
                    ? dataState.journals.find((candidate) => candidate.id === journal.reversesJournalEntryId)
                    : undefined;
                  const canReverse =
                    canPost &&
                    Boolean(writeService) &&
                    journal.status === 'posted' &&
                    !journal.reversesJournalEntryId &&
                    !reversedJournalIds.has(journal.id);

                  return (
                    <li key={journal.id}>
                      <strong>{journal.entryNumber}</strong>{' '}
                      <span>{journal.status ?? 'unknown'}</span>{' '}
                      {journal.reversesJournalEntryId && (
                        <span>Reversal of {original?.entryNumber ?? journal.reversesJournalEntryId}</span>
                      )}
                      {canReverse && (
                        <button type="button" onClick={() => setReversalJournalId(journal.id)}>
                          Reverse {journal.entryNumber}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {reversalJournalId && canPost && writeService && (
            <section className="atlas-status-panel" aria-label="Post journal reversal">
              <strong>Post reversal</strong>
              <form onSubmit={submitReversal} className="atlas-form">
                <label>
                  Reversal entry number
                  <input value={reversalEntryNumber} onChange={(event) => setReversalEntryNumber(event.target.value)} required />
                </label>
                <label>
                  Reversal date
                  <input type="date" value={reversalDate} onChange={(event) => setReversalDate(event.target.value)} />
                </label>
                <label>
                  Reversal reason
                  <input value={reversalReason} onChange={(event) => setReversalReason(event.target.value)} required />
                </label>
                <button type="submit" disabled={actionState.status === 'working'}>Post reversal</button>
              </form>
            </section>
          )}

          {actionState.status === 'success' && (
            <section className="atlas-status-panel" role="status">
              <strong>{actionState.message}</strong>
              <span>{actionState.id}</span>
            </section>
          )}

          {actionState.status === 'error' && (
            <section className="atlas-status-panel atlas-status-panel--degraded" role="alert">
              <strong>Journal operation failed</strong>
              <span>{actionState.message}</span>
            </section>
          )}
        </>
      )}
    </main>
  );
}
