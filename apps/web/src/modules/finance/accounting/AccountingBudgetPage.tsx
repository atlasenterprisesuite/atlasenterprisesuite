import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  budgetVsActual,
  type AccountRecord,
  type AccountingBudgetRecord,
  type BudgetLineRecord,
  type JournalRecord,
} from '../../../../../../packages/accounting/src';
import { createAtlasAccountingRepository } from '../../../lib/accountingRepository';
import {
  addAccountingBudgetLine,
  createAccountingBudget,
  getAccountingBudgets,
  setAccountingBudgetStatus,
  type AccountingBudgetLedger,
} from '../../../lib/atlasSession';

const accountingLinks = [
  ['dashboard', 'Command Center'],
  ['chart-of-accounts', 'Chart of Accounts'],
  ['general-ledger', 'General Ledger'],
  ['journal-entries', 'Journal Entries'],
  ['accounts-receivable', 'Receivables'],
  ['bank-cash', 'Bank & Cash'],
  ['reconciliation', 'Reconciliation'],
  ['fixed-assets', 'Fixed Assets'],
  ['budgeting', 'Budgeting'],
  ['forecast', 'Forecast'],
  ['period-close', 'Period Close'],
  ['reports', 'Reports'],
  ['audit-trail', 'Audit Trail'],
  ['settings', 'Settings'],
] as const;

function formatMoney(value: number, currencyCode: string) {
  const code = currencyCode.trim().toUpperCase() || 'USD';
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: code }).format(Number(value || 0));
  } catch {
    return `${code} ${new Intl.NumberFormat('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 2 }).format(Number(value || 0))}`;
  }
}

function parseDimension(value: string): Record<string, unknown> {
  const normalized = value.trim();
  if (!normalized) return {};
  const parsed = JSON.parse(normalized);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Dimension must be a JSON object');
  return parsed as Record<string, unknown>;
}

function dimensionLabel(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return '—';
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length === 0) return '—';
  return entries.map(([key, item]) => `${key}: ${String(item)}`).join(' · ');
}

export function AccountingBudgetPage() {
  const repository = useMemo(() => createAtlasAccountingRepository(), []);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [ledger, setLedger] = useState<AccountingBudgetLedger | null>(null);
  const [accounts, setAccounts] = useState<AccountRecord[]>([]);
  const [journals, setJournals] = useState<JournalRecord[]>([]);
  const [selectedBudgetId, setSelectedBudgetId] = useState('');
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [busy, setBusy] = useState(false);

  const [budgetName, setBudgetName] = useState('');
  const [fiscalYear, setFiscalYear] = useState(new Date().getUTCFullYear());
  const [version, setVersion] = useState(1);
  const [scenario, setScenario] = useState('base');
  const [baseCurrency, setBaseCurrency] = useState('USD');

  const [lineAccountId, setLineAccountId] = useState('');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [lineAmount, setLineAmount] = useState('');
  const [dimensionJson, setDimensionJson] = useState('{}');
  const [lineNote, setLineNote] = useState('');

  const load = useCallback(async () => {
    setStatus('loading');
    setError('');
    try {
      const budgetLedger = await getAccountingBudgets();
      const [accountRows, journalRows] = await Promise.all([
        repository.listAccounts(budgetLedger.organization.id),
        repository.listJournals(budgetLedger.organization.id),
      ]);
      setLedger(budgetLedger);
      setAccounts(accountRows);
      setJournals(journalRows);
      setSelectedBudgetId((current) => current && budgetLedger.budgets.some((row) => row.id === current)
        ? current
        : budgetLedger.budgets[0]?.id || '');
      setLineAccountId((current) => current || accountRows.find((row) => row.active)?.id || '');
      setStatus('ready');
    } catch (loadError) {
      setLedger(null);
      setAccounts([]);
      setJournals([]);
      setError(loadError instanceof Error ? loadError.message : 'Budgeting data could not be loaded');
      setStatus('error');
    }
  }, [repository]);

  useEffect(() => { void load(); }, [load]);

  const selectedBudget: AccountingBudgetRecord | null = ledger?.budgets.find((row) => row.id === selectedBudgetId) || null;
  const selectedLines: BudgetLineRecord[] = ledger?.lines.filter((row) => row.budgetId === selectedBudgetId) || [];
  const knownAccountIds = useMemo(() => new Set(accounts.map((row) => row.id)), [accounts]);
  const comparableLines = selectedLines.filter((row) => knownAccountIds.has(row.accountId));
  const orphanLines = selectedLines.length - comparableLines.length;
  const varianceRows = useMemo(() => budgetVsActual(accounts, comparableLines, journals), [accounts, comparableLines, journals]);
  const totals = useMemo(() => varianceRows.reduce((acc, row) => ({
    budget: acc.budget + row.budget,
    actual: acc.actual + row.actual,
    variance: acc.variance + row.variance,
  }), { budget: 0, actual: 0, variance: 0 }), [varianceRows]);
  const selectedCurrency = selectedBudget?.baseCurrency || 'USD';
  const hasDimensions = varianceRows.some((row) => row.dimension && typeof row.dimension === 'object' && !Array.isArray(row.dimension) && Object.keys(row.dimension as Record<string, unknown>).length > 0);

  async function createBudget(event: FormEvent) {
    event.preventDefault();
    if (!ledger) return;
    setBusy(true);
    setFeedback('');
    try {
      await createAccountingBudget({
        organizationId: ledger.organization.id,
        entityId: null,
        name: budgetName,
        fiscalYear: Number(fiscalYear),
        version: Number(version),
        scenario,
        baseCurrency,
      });
      setBudgetName('');
      setFeedback('Budget version created.');
      await load();
    } catch (writeError) {
      setFeedback(writeError instanceof Error ? writeError.message : 'Budget creation failed');
    } finally {
      setBusy(false);
    }
  }

  async function addLine(event: FormEvent) {
    event.preventDefault();
    if (!ledger || !selectedBudget) return;
    setBusy(true);
    setFeedback('');
    try {
      await addAccountingBudgetLine({
        organizationId: ledger.organization.id,
        budgetId: selectedBudget.id,
        accountId: lineAccountId,
        periodStart,
        periodEnd,
        amount: Number(lineAmount),
        dimension: parseDimension(dimensionJson),
        note: lineNote.trim() || null,
      });
      setLineAmount('');
      setLineNote('');
      setFeedback('Budget line added.');
      await load();
    } catch (writeError) {
      setFeedback(writeError instanceof Error ? writeError.message : 'Budget line failed');
    } finally {
      setBusy(false);
    }
  }

  async function changeStatus(nextStatus: 'draft' | 'approved' | 'locked' | 'archived') {
    if (!ledger || !selectedBudget) return;
    setBusy(true);
    setFeedback('');
    try {
      await setAccountingBudgetStatus(ledger.organization.id, selectedBudget.id, nextStatus);
      setFeedback(`Budget status changed to ${nextStatus}.`);
      await load();
    } catch (writeError) {
      setFeedback(writeError instanceof Error ? writeError.message : 'Budget status change failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="page-stack">
      <header className="page-header split-header">
        <div><p className="eyebrow">ATLAS Finance · Accounting</p><h1>Budgeting</h1><p>Versioned financial budgets by account and period, compared directly with posted ledger activity.</p></div>
        <div className="asof-card"><span>Control</span><strong>RLS + audited RPC</strong></div>
      </header>

      <nav className="accounting-nav" aria-label="Accounting navigation">
        {accountingLinks.map(([slug, label]) => <Link key={slug} className={slug === 'budgeting' ? 'accounting-nav-link active' : 'accounting-nav-link'} to={`/finance/accounting/${slug}`}>{label}</Link>)}
        <Link className="accounting-nav-link" to="/finance/accounting/accounts-payable">Payables + AI</Link>
      </nav>

      {status === 'loading' && <div className="notice">Loading authenticated budgets and posted ledger activity…</div>}
      {status === 'error' && <div className="connection-gate"><strong>Budgeting unavailable</strong><span>{error === 'authentication_required' ? 'Sign in through ATLAS Identity to load budgeting.' : error}</span><Link className="text-link" to={`/identity?app=${encodeURIComponent('/finance/accounting/budgeting')}`}>Open ATLAS Identity</Link></div>}

      {status === 'ready' && ledger && (
        <>
          <div className="workspace-card toolbar">
            <label className="field wide-field"><span>Budget version</span><select value={selectedBudgetId} onChange={(event) => setSelectedBudgetId(event.target.value)}><option value="">No budget selected</option>{ledger.budgets.map((row) => <option key={row.id} value={row.id}>{row.name} · FY{row.fiscalYear} · v{row.version} · {row.scenario} · {row.status}</option>)}</select></label>
          </div>

          {selectedBudget ? (
            <>
              <div className="metric-grid">
                <article><span>Budget</span><strong>{formatMoney(totals.budget, selectedCurrency)}</strong><small>{selectedCurrency} · {selectedLines.length} line(s)</small></article>
                <article><span>Actual</span><strong>{formatMoney(totals.actual, selectedCurrency)}</strong><small>Posted journals only</small></article>
                <article><span>Variance</span><strong>{formatMoney(totals.variance, selectedCurrency)}</strong><small>Actual minus budget</small></article>
                <article><span>Status</span><strong>{selectedBudget.status}</strong><small>FY{selectedBudget.fiscalYear} · version {selectedBudget.version}</small></article>
              </div>
              {orphanLines > 0 && <div className="notice strong">{orphanLines} budget line(s) reference an account not present in the current Chart of Accounts and are excluded from variance calculations.</div>}
              {hasDimensions && <div className="notice strong">Dimensions are preserved on budget lines. Current actuals are still account-level because posted journal lines do not yet carry matching dimension fields; ATLAS does not claim dimension-level actuals until that ledger integration exists.</div>}
              <div className="workspace-card table-wrap"><table><thead><tr><th>Period</th><th>Account</th><th>Type</th><th>Dimensions</th><th>Budget</th><th>Actual</th><th>Variance</th><th>Variance %</th></tr></thead><tbody>{varianceRows.map((row) => <tr key={row.budgetLineId}><td><strong>{row.periodStart}</strong><small>to {row.periodEnd}</small></td><td><strong>{row.accountNumber}</strong><small>{row.accountName}</small></td><td>{row.accountType}</td><td><small>{dimensionLabel(row.dimension)}</small></td><td className="money">{formatMoney(row.budget, selectedCurrency)}</td><td className="money">{formatMoney(row.actual, selectedCurrency)}</td><td className="money">{formatMoney(row.variance, selectedCurrency)}</td><td>{row.variancePct === null ? '—' : `${row.variancePct}%`}</td></tr>)}</tbody></table>{varianceRows.length === 0 && <div className="empty-state"><strong>No budget lines</strong><span>Add an account-period line to calculate Budget vs Actual.</span></div>}</div>

              <div className="workspace-card toolbar">
                <button className="link-button" type="button" disabled={busy || selectedBudget.status !== 'draft'} onClick={() => void changeStatus('approved')}>Approve budget</button>
                <button className="link-button" type="button" disabled={busy || selectedBudget.status !== 'approved'} onClick={() => void changeStatus('locked')}>Lock budget</button>
                <button className="link-button" type="button" disabled={busy || selectedBudget.status === 'locked'} onClick={() => void changeStatus('archived')}>Archive</button>
              </div>

              <form className="workspace-card toolbar" onSubmit={addLine}>
                <label className="field"><span>Account</span><select value={lineAccountId} onChange={(event) => setLineAccountId(event.target.value)} required>{accounts.filter((row) => row.active).map((row) => <option key={row.id} value={row.id}>{row.accountNumber} · {row.name}</option>)}</select></label>
                <label className="field"><span>Period start</span><input type="date" value={periodStart} onChange={(event) => setPeriodStart(event.target.value)} required /></label>
                <label className="field"><span>Period end</span><input type="date" value={periodEnd} onChange={(event) => setPeriodEnd(event.target.value)} required /></label>
                <label className="field"><span>Amount</span><input type="number" step="0.01" value={lineAmount} onChange={(event) => setLineAmount(event.target.value)} required /></label>
                <label className="field wide-field"><span>Dimensions JSON</span><input value={dimensionJson} onChange={(event) => setDimensionJson(event.target.value)} placeholder='{"department":"Finance","project":"Atlas"}' /></label>
                <label className="field wide-field"><span>Note</span><input value={lineNote} onChange={(event) => setLineNote(event.target.value)} /></label>
                <button className="link-button" disabled={busy || selectedBudget.status !== 'draft'} type="submit">Add budget line</button>
              </form>
            </>
          ) : <div className="empty-state"><strong>No budget version selected</strong><span>Create the first financial budget below.</span></div>}

          <form className="workspace-card toolbar" onSubmit={createBudget}>
            <label className="field wide-field"><span>Budget name</span><input value={budgetName} onChange={(event) => setBudgetName(event.target.value)} required /></label>
            <label className="field"><span>Fiscal year</span><input type="number" min="2000" max="2200" value={fiscalYear} onChange={(event) => setFiscalYear(Number(event.target.value))} required /></label>
            <label className="field"><span>Version</span><input type="number" min="1" value={version} onChange={(event) => setVersion(Number(event.target.value))} required /></label>
            <label className="field"><span>Scenario</span><input value={scenario} onChange={(event) => setScenario(event.target.value)} required /></label>
            <label className="field"><span>Currency</span><input maxLength={3} value={baseCurrency} onChange={(event) => setBaseCurrency(event.target.value.toUpperCase())} required /></label>
            <button className="link-button" disabled={busy} type="submit">Create budget version</button>
          </form>
          {feedback && <div className="notice">{feedback}</div>}
        </>
      )}
    </section>
  );
}