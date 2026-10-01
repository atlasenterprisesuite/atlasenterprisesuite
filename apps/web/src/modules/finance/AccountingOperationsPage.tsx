import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  closeAccountingPeriod,
  closeAccountingReconciliation,
  createAccountingPeriod,
  createBalancedJournalEntry,
  getAccountingCloseReadiness,
  loadAccountingClose,
  loadAccountingReconciliation,
  loadGeneralLedger,
  resolveAccountingReconciliationItem,
  reversePostedJournalEntry,
  startAccountingReconciliation,
  updateAccountingCloseTask,
  type AccountingAccount,
  type AccountingClosePeriod,
  type AccountingCloseReadiness,
  type AccountingCloseTask,
  type AccountingReconciliationItem,
  type AccountingReconciliationSession,
  type AccountingBankAccount,
  type GeneralLedgerRow
} from '../../lib/financeApi';

export type AccountingOperationsView = 'ledger' | 'reconciliation' | 'close';

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

function dateInput(offsetDays = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

function firstDayOfMonth() {
  const date = new Date();
  date.setDate(1);
  return date.toISOString().slice(0, 10);
}

function AccountingNav({ view }: { view: AccountingOperationsView }) {
  const items: Array<[AccountingOperationsView, string, string]> = [
    ['ledger', 'General Ledger', '/finance/accounting/general-ledger'],
    ['reconciliation', 'Bank Reconciliation', '/finance/accounting/reconciliation'],
    ['close', 'Period Close', '/finance/accounting/close']
  ];
  return <nav className="work-subnav" aria-label="Accounting operations">
    <Link to="/finance/accounting">Accounting overview</Link>
    {items.map(([id, label, to]) => <Link className={view === id ? 'active' : ''} to={to} key={id}>{label}</Link>)}
  </nav>;
}

function GeneralLedgerWorkspace() {
  const [startDate, setStartDate] = useState(firstDayOfMonth());
  const [endDate, setEndDate] = useState(dateInput());
  const [rows, setRows] = useState<GeneralLedgerRow[]>([]);
  const [accounts, setAccounts] = useState<AccountingAccount[]>([]);
  const [entryCode, setEntryCode] = useState('');
  const [memo, setMemo] = useState('');
  const [debitAccount, setDebitAccount] = useState('');
  const [creditAccount, setCreditAccount] = useState('');
  const [amount, setAmount] = useState('');
  const [reverseJournalId, setReverseJournalId] = useState('');
  const [reversalCode, setReversalCode] = useState('');
  const [reversalReason, setReversalReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function refresh() {
    setError('');
    try {
      const data = await loadGeneralLedger(startDate, endDate);
      setRows(data.ledger);
      setAccounts(data.accounts);
      if (!debitAccount && data.accounts[0]) setDebitAccount(data.accounts[0].id);
      if (!creditAccount && data.accounts[1]) setCreditAccount(data.accounts[1].id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'general_ledger_unavailable');
    }
  }

  useEffect(() => { void refresh(); }, []);

  const totals = useMemo(() => rows.reduce((acc, row) => {
    acc.debit += Number(row.debit || 0);
    acc.credit += Number(row.credit || 0);
    return acc;
  }, { debit: 0, credit: 0 }), [rows]);

  async function createJournal() {
    const numeric = Number(amount);
    if (!entryCode.trim() || !debitAccount || !creditAccount || debitAccount === creditAccount || !Number.isFinite(numeric) || numeric <= 0) {
      setError('Journal code, distinct debit/credit accounts and a positive amount are required.');
      return;
    }
    setBusy(true); setError(''); setMessage('');
    try {
      await createBalancedJournalEntry({ entryCode, entryDate: dateInput(), memo, debitAccountId: debitAccount, creditAccountId: creditAccount, amount: numeric });
      setEntryCode(''); setMemo(''); setAmount('');
      setMessage('Balanced journal entry posted through the governed Accounting RPC.');
      await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'journal_create_failed'); }
    finally { setBusy(false); }
  }

  async function reverseJournal() {
    if (!reverseJournalId || !reversalCode.trim() || !reversalReason.trim()) {
      setError('Journal, reversal code and reason are required.');
      return;
    }
    setBusy(true); setError(''); setMessage('');
    try {
      await reversePostedJournalEntry({ journalId: reverseJournalId, reversalCode, reversalDate: dateInput(), reason: reversalReason });
      setReverseJournalId(''); setReversalCode(''); setReversalReason('');
      setMessage('Posted journal reversed through the immutable reversal contract.');
      await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'journal_reversal_failed'); }
    finally { setBusy(false); }
  }

  const uniqueJournals = [...new Map(rows.map(row => [row.journal_entry_id, row])).values()];

  return <>
    <section className="execution-panel">
      <div className="work-section-heading"><div><p className="eyebrow">Live ledger</p><h2>General Ledger</h2><p>Source-backed double-entry activity from the canonical Accounting ledger.</p></div></div>
      <div className="work-config-grid">
        <label><span>Start</span><input type="date" value={startDate} onChange={event => setStartDate(event.target.value)} /></label>
        <label><span>End</span><input type="date" value={endDate} onChange={event => setEndDate(event.target.value)} /></label>
      </div>
      <button className="module-experience-action secondary" type="button" onClick={() => void refresh()}>Refresh ledger</button>
      <div className="metric-grid">
        <article><span>Debit</span><strong>{money.format(totals.debit)}</strong></article>
        <article><span>Credit</span><strong>{money.format(totals.credit)}</strong></article>
        <article><span>Difference</span><strong>{money.format(totals.debit - totals.credit)}</strong></article>
        <article><span>Lines</span><strong>{rows.length}</strong></article>
      </div>
      <div className="table-wrap">
        <table><thead><tr><th>Date</th><th>Entry</th><th>Account</th><th>Memo</th><th>Debit</th><th>Credit</th><th>Running</th></tr></thead>
        <tbody>{rows.map((row, index) => <tr key={row.journal_entry_id + '-' + row.account_number + '-' + index}>
          <td>{row.entry_date}</td><td>{row.entry_number}</td><td>{row.account_number} · {row.account_name}</td><td>{row.memo || '—'}</td>
          <td>{money.format(Number(row.debit || 0))}</td><td>{money.format(Number(row.credit || 0))}</td><td>{money.format(Number(row.running_balance || 0))}</td>
        </tr>)}</tbody></table>
      </div>
      {!rows.length ? <p className="muted">No ledger lines exist in the selected period.</p> : null}
    </section>

    <section className="execution-panel">
      <h2>Post balanced journal</h2>
      <div className="work-config-grid">
        <label><span>Entry code</span><input value={entryCode} onChange={event => setEntryCode(event.target.value)} maxLength={80} /></label>
        <label><span>Amount</span><input type="number" min="0.01" step="0.01" value={amount} onChange={event => setAmount(event.target.value)} /></label>
        <label><span>Debit account</span><select value={debitAccount} onChange={event => setDebitAccount(event.target.value)}>{accounts.map(account => <option value={account.id} key={account.id}>{account.account_number} · {account.name}</option>)}</select></label>
        <label><span>Credit account</span><select value={creditAccount} onChange={event => setCreditAccount(event.target.value)}>{accounts.map(account => <option value={account.id} key={account.id}>{account.account_number} · {account.name}</option>)}</select></label>
      </div>
      <label><span>Memo</span><input value={memo} onChange={event => setMemo(event.target.value)} maxLength={500} /></label>
      <button className="execution-action" type="button" disabled={busy} onClick={() => void createJournal()}>Post journal</button>
    </section>

    <section className="execution-panel">
      <h2>Reverse posted journal</h2>
      <div className="work-config-grid">
        <label><span>Journal</span><select value={reverseJournalId} onChange={event => setReverseJournalId(event.target.value)}><option value="">Select…</option>{uniqueJournals.map(row => <option value={row.journal_entry_id} key={row.journal_entry_id}>{row.entry_number} · {row.entry_date}</option>)}</select></label>
        <label><span>Reversal code</span><input value={reversalCode} onChange={event => setReversalCode(event.target.value)} /></label>
      </div>
      <label><span>Reason</span><input value={reversalReason} onChange={event => setReversalReason(event.target.value)} /></label>
      <button className="execution-action" type="button" disabled={busy} onClick={() => void reverseJournal()}>Create reversal</button>
    </section>
    {error ? <div className="notice strong" role="alert">{error}</div> : null}
    {message ? <div className="notice" role="status">{message}</div> : null}
  </>;
}

function ReconciliationWorkspace() {
  const [banks, setBanks] = useState<AccountingBankAccount[]>([]);
  const [sessions, setSessions] = useState<AccountingReconciliationSession[]>([]);
  const [items, setItems] = useState<AccountingReconciliationItem[]>([]);
  const [bankId, setBankId] = useState('');
  const [start, setStart] = useState(firstDayOfMonth());
  const [end, setEnd] = useState(dateInput());
  const [statementBalance, setStatementBalance] = useState('');
  const [ledgerBalance, setLedgerBalance] = useState('');
  const [selectedItem, setSelectedItem] = useState('');
  const [itemStatus, setItemStatus] = useState('resolved');
  const [matchType, setMatchType] = useState('manual');
  const [variance, setVariance] = useState('0');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function refresh() {
    setError('');
    try {
      const data = await loadAccountingReconciliation();
      setBanks(data.banks); setSessions(data.sessions); setItems(data.items);
      if (!bankId && data.banks[0]) setBankId(data.banks[0].id);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'reconciliation_unavailable'); }
  }
  useEffect(() => { void refresh(); }, []);

  async function startSession() {
    const statement = Number(statementBalance), ledger = Number(ledgerBalance);
    if (!bankId || !Number.isFinite(statement) || !Number.isFinite(ledger)) { setError('Bank account and valid balances are required.'); return; }
    setBusy(true); setError(''); setMessage('');
    try {
      await startAccountingReconciliation({ bankAccountId: bankId, periodStart: start, periodEnd: end, statementBalance: statement, ledgerBalance: ledger });
      setMessage('Reconciliation session created from the governed Accounting contract.');
      await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'reconciliation_start_failed'); }
    finally { setBusy(false); }
  }

  async function closeSession(id: string) {
    setBusy(true); setError(''); setMessage('');
    try { await closeAccountingReconciliation(id); setMessage('Reconciliation closed after server-side readiness checks.'); await refresh(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'reconciliation_close_failed'); }
    finally { setBusy(false); }
  }

  async function resolveItem() {
    const numeric = Number(variance);
    if (!selectedItem || !Number.isFinite(numeric)) { setError('Select an item and enter a valid variance.'); return; }
    setBusy(true); setError(''); setMessage('');
    try {
      await resolveAccountingReconciliationItem({ itemId: selectedItem, status: itemStatus, matchType, variance: numeric, note });
      setMessage('Reconciliation item updated under the accounting permission boundary.');
      await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'reconciliation_item_failed'); }
    finally { setBusy(false); }
  }

  return <>
    <section className="execution-panel">
      <h2>Bank & Reconciliation</h2>
      <p>Bank records, statement balances, ledger balances and item resolution remain explicitly source-backed. A registered bank record is not represented as a live bank connection unless its connection state says so.</p>
      <div className="module-experience-grid">
        {banks.map(bank => <article className="module-experience-card is-active" key={bank.id}><span className="module-experience-card-label">{bank.connection_state}</span><strong>{bank.display_name}</strong><p>{bank.account_type || 'account'} · {bank.currency} · {bank.mask ? '••••' + bank.mask : 'no mask'}</p><small>{bank.current_balance === null ? 'Balance unavailable' : money.format(Number(bank.current_balance))}</small></article>)}
      </div>
    </section>
    <section className="execution-panel">
      <h2>Start reconciliation</h2>
      <div className="work-config-grid">
        <label><span>Bank account</span><select value={bankId} onChange={event => setBankId(event.target.value)}>{banks.map(bank => <option value={bank.id} key={bank.id}>{bank.display_name}</option>)}</select></label>
        <label><span>Period start</span><input type="date" value={start} onChange={event => setStart(event.target.value)} /></label>
        <label><span>Period end</span><input type="date" value={end} onChange={event => setEnd(event.target.value)} /></label>
        <label><span>Statement ending balance</span><input type="number" step="0.01" value={statementBalance} onChange={event => setStatementBalance(event.target.value)} /></label>
        <label><span>Ledger ending balance</span><input type="number" step="0.01" value={ledgerBalance} onChange={event => setLedgerBalance(event.target.value)} /></label>
      </div>
      <button className="execution-action" type="button" disabled={busy || !banks.length} onClick={() => void startSession()}>Start reconciliation</button>
    </section>
    <section className="execution-panel">
      <h2>Sessions</h2>
      <div className="module-experience-grid">{sessions.map(session => <article className="module-experience-card is-active" key={session.id}><span className="module-experience-card-label">{session.status}</span><strong>{session.period_start} → {session.period_end}</strong><p>Readiness {Number(session.readiness_score || 0).toFixed(0)}% · statement {money.format(Number(session.statement_ending_balance || 0))} · ledger {money.format(Number(session.ledger_ending_balance || 0))}</p>{!['reconciled','locked'].includes(session.status) ? <button type="button" disabled={busy} onClick={() => void closeSession(session.id)}>Close when ready</button> : null}</article>)}</div>
    </section>
    <section className="execution-panel">
      <h2>Resolve reconciliation item</h2>
      <div className="work-config-grid">
        <label><span>Open item</span><select value={selectedItem} onChange={event => setSelectedItem(event.target.value)}><option value="">Select…</option>{items.filter(item => item.status === 'open').map(item => <option value={item.id} key={item.id}>{item.id.slice(0,8)} · variance {Number(item.variance || 0).toFixed(2)}</option>)}</select></label>
        <label><span>Status</span><select value={itemStatus} onChange={event => setItemStatus(event.target.value)}><option value="resolved">Resolved</option><option value="excluded">Excluded</option></select></label>
        <label><span>Match type</span><select value={matchType} onChange={event => setMatchType(event.target.value)}>{['matched','unmatched','duplicate','timing_difference','transfer','manual'].map(value => <option value={value} key={value}>{value}</option>)}</select></label>
        <label><span>Variance</span><input type="number" step="0.01" value={variance} onChange={event => setVariance(event.target.value)} /></label>
      </div>
      <label><span>Resolution note</span><input value={note} onChange={event => setNote(event.target.value)} /></label>
      <button className="execution-action" type="button" disabled={busy || !selectedItem} onClick={() => void resolveItem()}>Resolve item</button>
    </section>
    {error ? <div className="notice strong" role="alert">{error}</div> : null}
    {message ? <div className="notice" role="status">{message}</div> : null}
  </>;
}

function CloseWorkspace() {
  const [periods, setPeriods] = useState<AccountingClosePeriod[]>([]);
  const [tasks, setTasks] = useState<AccountingCloseTask[]>([]);
  const [periodId, setPeriodId] = useState('');
  const [readiness, setReadiness] = useState<AccountingCloseReadiness | null>(null);
  const [newStart, setNewStart] = useState(firstDayOfMonth());
  const [newEnd, setNewEnd] = useState(dateInput());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function refresh(preferredPeriodId?: string) {
    setError('');
    try {
      const data = await loadAccountingClose();
      setPeriods(data.periods); setTasks(data.tasks);
      const selected = preferredPeriodId || periodId || data.periods.find(period => !['closed','locked'].includes(period.status))?.id || data.periods[0]?.id || '';
      setPeriodId(selected);
      setReadiness(selected ? await getAccountingCloseReadiness(selected) : null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'accounting_close_unavailable'); }
  }
  useEffect(() => { void refresh(); }, []);

  async function selectPeriod(id: string) {
    setPeriodId(id); setError('');
    try { setReadiness(id ? await getAccountingCloseReadiness(id) : null); }
    catch (cause) { setReadiness(null); setError(cause instanceof Error ? cause.message : 'close_readiness_unavailable'); }
  }

  async function createPeriod() {
    if (!newStart || !newEnd || newEnd < newStart) { setError('Valid period dates are required.'); return; }
    setBusy(true); setError(''); setMessage('');
    try {
      const period = await createAccountingPeriod({ periodStart: newStart, periodEnd: newEnd });
      setMessage('Accounting period created.');
      await refresh(period?.id);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'period_create_failed'); }
    finally { setBusy(false); }
  }

  async function updateTask(taskId: string, status: AccountingCloseTask['status']) {
    setBusy(true); setError(''); setMessage('');
    try { await updateAccountingCloseTask({ taskId, status: status as any }); setMessage('Close task updated.'); await refresh(periodId); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'close_task_update_failed'); }
    finally { setBusy(false); }
  }

  async function lockPeriod() {
    if (!periodId) return;
    setBusy(true); setError(''); setMessage('');
    try { await closeAccountingPeriod(periodId); setMessage('Period locked after server-side close controls passed.'); await refresh(periodId); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'period_close_failed'); }
    finally { setBusy(false); }
  }

  const periodTasks = tasks.filter(task => task.period_id === periodId);
  return <>
    <section className="execution-panel">
      <h2>Period Close</h2>
      <p>The close action remains fail-closed: checklist, reconciliations and posted debit/credit balance are revalidated in PostgreSQL before a period can lock.</p>
      <div className="work-config-grid">
        <label><span>Period</span><select value={periodId} onChange={event => void selectPeriod(event.target.value)}><option value="">Select…</option>{periods.map(period => <option value={period.id} key={period.id}>{period.period_start} → {period.period_end} · {period.status}</option>)}</select></label>
        <label><span>New period start</span><input type="date" value={newStart} onChange={event => setNewStart(event.target.value)} /></label>
        <label><span>New period end</span><input type="date" value={newEnd} onChange={event => setNewEnd(event.target.value)} /></label>
      </div>
      <button className="module-experience-action secondary" type="button" disabled={busy} onClick={() => void createPeriod()}>Create period</button>
    </section>
    {readiness ? <div className="metric-grid">
      <article><span>Close readiness</span><strong>{Number(readiness.readiness_score || 0).toFixed(0)}%</strong></article>
      <article><span>Incomplete tasks</span><strong>{readiness.incomplete_tasks}</strong></article>
      <article><span>Open reconciliations</span><strong>{readiness.unreconciled_sessions}</strong></article>
      <article><span>Debit/credit difference</span><strong>{money.format(Number(readiness.debit_credit_difference || 0))}</strong></article>
    </div> : null}
    <section className="execution-panel">
      <h2>Close checklist</h2>
      <div className="module-experience-grid">{periodTasks.map(task => <article className="module-experience-card is-active" key={task.id}><span className="module-experience-card-label">{task.task_group} · {task.status}</span><strong>{task.name}</strong><p>{task.blocker || task.owner_label || 'No blocker recorded.'}</p><div className="atlas-action-row"><button type="button" disabled={busy} onClick={() => void updateTask(task.id, 'in_progress')}>In progress</button><button type="button" disabled={busy} onClick={() => void updateTask(task.id, 'complete')}>Complete</button></div></article>)}</div>
      {!periodTasks.length && periodId ? <p className="notice">This period has no close checklist yet. The database will refuse to lock it until checklist rows exist.</p> : null}
      <button className="execution-action" type="button" disabled={busy || !periodId || readiness?.ready !== true} onClick={() => void lockPeriod()}>Lock period</button>
    </section>
    {error ? <div className="notice strong" role="alert">{error}</div> : null}
    {message ? <div className="notice" role="status">{message}</div> : null}
  </>;
}

export function AccountingOperationsPage({ view }: { view: AccountingOperationsView }) {
  return (
    <section className="page-stack">
      <header className="page-header"><p className="eyebrow">ATLAS Finance · Accounting</p><h1>{view === 'ledger' ? 'General Ledger' : view === 'reconciliation' ? 'Bank Reconciliation' : 'Period Close'}</h1><p>Governed accounting operations over the canonical ledger, reconciliation and close contracts already enforced by ATLAS.</p></header>
      <AccountingNav view={view} />
      {view === 'ledger' ? <GeneralLedgerWorkspace /> : view === 'reconciliation' ? <ReconciliationWorkspace /> : <CloseWorkspace />}
    </section>
  );
}
