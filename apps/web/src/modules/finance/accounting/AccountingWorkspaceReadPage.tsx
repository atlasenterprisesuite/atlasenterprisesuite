import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  balanceSheet,
  profitAndLoss,
  trialBalance,
  type AccountRecord,
  type AccountingAuditEvent,
  type AccountingCloseTaskRecord,
  type AccountingPeriodRecord,
  type AccountingRepository,
  type AccountingSettingsRecord,
  type BankAccountRecord,
  type BankTransactionRecord,
  type BillRecord,
  type FixedAssetRecord,
  type InvoiceRecord,
  type JournalRecord,
  type PartyRecord,
  type PaymentRecord,
  type ReconciliationItemRecord,
  type ReconciliationSessionRecord,
} from '../../../../../../packages/accounting/src';
import { createAtlasAccountingRepository } from '../../../lib/accountingRepository';
import {
  getAccountingInsight,
  getActiveAtlasOrganization,
  type AccountingInsight,
  type AtlasOrganization,
} from '../../../lib/atlasSession';

export type AccountingSection =
  | 'dashboard'
  | 'chart-of-accounts'
  | 'general-ledger'
  | 'journal-entries'
  | 'accounts-receivable'
  | 'bank-cash'
  | 'reconciliation'
  | 'fixed-assets'
  | 'period-close'
  | 'reports'
  | 'audit-trail'
  | 'settings';

type WorkspaceData = {
  accounts: AccountRecord[];
  journals: JournalRecord[];
  customers: PartyRecord[];
  invoices: InvoiceRecord[];
  payments: PaymentRecord[];
  bills: BillRecord[];
  bankAccounts: BankAccountRecord[];
  bankTransactions: BankTransactionRecord[];
  reconciliationSessions: ReconciliationSessionRecord[];
  reconciliationItems: ReconciliationItemRecord[];
  fixedAssets: FixedAssetRecord[];
  periods: AccountingPeriodRecord[];
  closeTasks: AccountingCloseTaskRecord[];
  auditEvents: AccountingAuditEvent[];
  settings: AccountingSettingsRecord | null;
};

const blankData = (): WorkspaceData => ({
  accounts: [], journals: [], customers: [], invoices: [], payments: [], bills: [], bankAccounts: [],
  bankTransactions: [], reconciliationSessions: [], reconciliationItems: [], fixedAssets: [], periods: [],
  closeTasks: [], auditEvents: [], settings: null,
});

const sections: Array<{ slug: AccountingSection; label: string }> = [
  { slug: 'dashboard', label: 'Command Center' },
  { slug: 'chart-of-accounts', label: 'Chart of Accounts' },
  { slug: 'general-ledger', label: 'General Ledger' },
  { slug: 'journal-entries', label: 'Journal Entries' },
  { slug: 'accounts-receivable', label: 'Receivables' },
  { slug: 'bank-cash', label: 'Bank & Cash' },
  { slug: 'reconciliation', label: 'Reconciliation' },
  { slug: 'fixed-assets', label: 'Fixed Assets' },
  { slug: 'period-close', label: 'Period Close' },
  { slug: 'reports', label: 'Reports' },
  { slug: 'audit-trail', label: 'Audit Trail' },
  { slug: 'settings', label: 'Settings' },
];

const metadata: Record<AccountingSection, { title: string; description: string }> = {
  dashboard: { title: 'Accounting Command Center', description: 'Live operational accounting status from the authenticated organization.' },
  'chart-of-accounts': { title: 'Chart of Accounts', description: 'Canonical account structure used by the governed ATLAS ledger.' },
  'general-ledger': { title: 'General Ledger', description: 'Posted debit and credit activity summarized from journal lines.' },
  'journal-entries': { title: 'Journal Entries', description: 'Posted and draft journals with balanced-line visibility and reversal lineage.' },
  'accounts-receivable': { title: 'Accounts Receivable', description: 'Customer invoices, balances, payment state and aging inputs.' },
  'bank-cash': { title: 'Bank & Cash', description: 'Connected bank accounts and imported accounting transactions.' },
  reconciliation: { title: 'Reconciliation', description: 'Statement-to-ledger reconciliation sessions, exceptions and readiness.' },
  'fixed-assets': { title: 'Fixed Assets', description: 'Asset register, useful life and accumulated depreciation state.' },
  'period-close': { title: 'Period Close', description: 'Accounting periods and evidence-backed close checklist.' },
  reports: { title: 'Financial Reports', description: 'Trial Balance, Profit & Loss and Balance Sheet derived from the same ledger.' },
  'audit-trail': { title: 'Audit Trail', description: 'Organization-scoped accounting changes with before/after evidence where recorded.' },
  settings: { title: 'Accounting Settings', description: 'Fiscal year, base currency, accounting basis and control-account configuration.' },
};

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const number = new Intl.NumberFormat('en-US');

function amount(value: number | null | undefined) {
  return currency.format(Number(value ?? 0));
}

function matches(query: string, ...values: unknown[]) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  return values.some((value) => String(value ?? '').toLowerCase().includes(normalized));
}

async function loadSection(repository: AccountingRepository, organizationId: string, section: AccountingSection): Promise<WorkspaceData> {
  const data = blankData();
  if (section === 'dashboard') {
    const [accounts, journals, invoices, bills, bankAccounts, periods, closeTasks] = await Promise.all([
      repository.listAccounts(organizationId), repository.listJournals(organizationId), repository.listInvoices(organizationId),
      repository.listBills(organizationId), repository.listBankAccounts(organizationId), repository.listAccountingPeriods(organizationId),
      repository.listCloseTasks(organizationId),
    ]);
    return { ...data, accounts, journals, invoices, bills, bankAccounts, periods, closeTasks };
  }
  if (section === 'chart-of-accounts') data.accounts = await repository.listAccounts(organizationId);
  if (section === 'general-ledger' || section === 'journal-entries' || section === 'reports') {
    [data.accounts, data.journals] = await Promise.all([
      repository.listAccounts(organizationId), repository.listJournals(organizationId),
    ]);
  }
  if (section === 'accounts-receivable') {
    [data.customers, data.invoices, data.payments] = await Promise.all([
      repository.listCustomers(organizationId), repository.listInvoices(organizationId), repository.listPayments(organizationId),
    ]);
  }
  if (section === 'bank-cash') {
    [data.bankAccounts, data.bankTransactions] = await Promise.all([
      repository.listBankAccounts(organizationId), repository.listBankTransactions(organizationId),
    ]);
  }
  if (section === 'reconciliation') {
    [data.reconciliationSessions, data.reconciliationItems] = await Promise.all([
      repository.listReconciliationSessions(organizationId), repository.listReconciliationItems(organizationId),
    ]);
  }
  if (section === 'fixed-assets') data.fixedAssets = await repository.listFixedAssets(organizationId);
  if (section === 'period-close') {
    [data.periods, data.closeTasks] = await Promise.all([
      repository.listAccountingPeriods(organizationId), repository.listCloseTasks(organizationId),
    ]);
  }
  if (section === 'audit-trail') data.auditEvents = await repository.listAuditEvents(organizationId);
  if (section === 'settings') {
    [data.settings, data.accounts] = await Promise.all([
      repository.getAccountingSettings(organizationId), repository.listAccounts(organizationId),
    ]);
  }
  return data;
}

function AccountingNav({ active }: { active: AccountingSection }) {
  return (
    <nav className="accounting-nav" aria-label="Accounting navigation">
      {sections.map((item) => (
        <Link key={item.slug} className={item.slug === active ? 'accounting-nav-link active' : 'accounting-nav-link'} to={`/finance/accounting/${item.slug}`}>
          {item.label}
        </Link>
      ))}
      <Link className="accounting-nav-link" to="/finance/accounting/accounts-payable">Payables + AI</Link>
    </nav>
  );
}

function Search({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return <label className="field accounting-search"><span>Search</span><input value={value} onChange={(event) => onChange(event.target.value)} placeholder="Search current accounting view" /></label>;
}

function Dashboard({ data, insight }: { data: WorkspaceData; insight: AccountingInsight | null }) {
  const cash = data.bankAccounts.reduce((sum, row) => sum + Number(row.currentBalance ?? 0), 0);
  const ar = data.invoices.reduce((sum, row) => sum + Number(row.balanceDue ?? 0), 0);
  const ap = data.bills.reduce((sum, row) => sum + Number(row.balanceDue ?? 0), 0);
  const posted = data.journals.filter((row) => row.status === 'posted').length;
  const latestPeriod = [...data.periods].sort((a, b) => b.periodEnd.localeCompare(a.periodEnd))[0];
  const blockedTasks = data.closeTasks.filter((task) => Boolean(task.blocker) || task.status === 'blocked').length;
  return (
    <>
      <div className="metric-grid">
        <article><span>Bank / cash balance</span><strong>{amount(cash)}</strong><small>{number.format(data.bankAccounts.length)} account(s)</small></article>
        <article><span>Open receivables</span><strong>{amount(ar)}</strong><small>{number.format(data.invoices.length)} invoice(s)</small></article>
        <article><span>Open payables</span><strong>{amount(ap)}</strong><small>{number.format(data.bills.length)} bill(s)</small></article>
        <article><span>Posted journals</span><strong>{number.format(posted)}</strong><small>{number.format(data.journals.length)} total journal(s)</small></article>
      </div>
      <div className="module-grid">
        <article className="module-card"><span>Period close</span><strong>{latestPeriod ? `${latestPeriod.closeReadiness}% ready` : 'No active period'}</strong><p>{blockedTasks ? `${blockedTasks} blocked close task(s) require review.` : 'No recorded close blockers in the loaded scope.'}</p></article>
        <article className="module-card"><span>ATLAS Accounting AI</span><strong>{insight?.model || 'AI status unavailable'}</strong><p>{insight?.analysis || 'No authenticated AI analysis was returned for this session.'}</p></article>
      </div>
    </>
  );
}

function ChartOfAccounts({ rows, query }: { rows: AccountRecord[]; query: string }) {
  const visible = rows.filter((row) => matches(query, row.accountNumber, row.name, row.accountType, row.active ? 'active' : 'inactive'));
  return <div className="workspace-card table-wrap"><table><thead><tr><th>Account</th><th>Name</th><th>Type</th><th>Status</th></tr></thead><tbody>{visible.map((row) => <tr key={row.id}><td>{row.accountNumber}</td><td><strong>{row.name}</strong></td><td>{row.accountType}</td><td><span className="status-pill">{row.active ? 'active' : 'inactive'}</span></td></tr>)}</tbody></table>{visible.length === 0 && <div className="empty-state"><strong>No accounts found</strong><span>No rows match the current organization and search.</span></div>}</div>;
}

function Ledger({ data, query }: { data: WorkspaceData; query: string }) {
  const report = trialBalance(data.accounts, data.journals);
  const rows = report.rows.filter((row) => matches(query, row.accountNumber, row.accountName, row.accountType));
  return <><div className={report.balanced ? 'notice' : 'notice strong'}>Trial Balance invariant: {report.balanced ? 'PASS' : 'FAIL'} · Debits {amount(report.totalDebits)} · Credits {amount(report.totalCredits)}</div><div className="workspace-card table-wrap"><table><thead><tr><th>Account</th><th>Name</th><th>Type</th><th>Debits</th><th>Credits</th><th>Balance</th></tr></thead><tbody>{rows.map((row) => <tr key={row.accountId}><td>{row.accountNumber}</td><td>{row.accountName}</td><td>{row.accountType}</td><td className="money">{amount(row.totalDebits)}</td><td className="money">{amount(row.totalCredits)}</td><td className="money">{amount(row.balance)}</td></tr>)}</tbody></table></div></>;
}

function Journals({ rows, query }: { rows: JournalRecord[]; query: string }) {
  const visible = rows.filter((row) => matches(query, row.entryNumber, row.entryDate, row.memo, row.status));
  return <div className="workspace-card table-wrap"><table><thead><tr><th>Entry</th><th>Date</th><th>Memo</th><th>Status</th><th>Debits</th><th>Credits</th><th>Reversal</th></tr></thead><tbody>{visible.map((row) => { const debits = row.lines.reduce((sum, line) => sum + Number(line.debit ?? 0), 0); const credits = row.lines.reduce((sum, line) => sum + Number(line.credit ?? 0), 0); return <tr key={row.id}><td><strong>{row.entryNumber}</strong></td><td>{row.entryDate || '—'}</td><td>{row.memo || '—'}</td><td><span className="status-pill">{row.status || 'unknown'}</span></td><td className="money">{amount(debits)}</td><td className="money">{amount(credits)}</td><td>{row.reversesJournalEntryId ? 'Reversal entry' : '—'}</td></tr>; })}</tbody></table>{visible.length === 0 && <div className="empty-state"><strong>No journal entries</strong><span>No rows match the current scope.</span></div>}</div>;
}

function Receivables({ data, query }: { data: WorkspaceData; query: string }) {
  const customers = new Map(data.customers.map((row) => [row.id, row.name]));
  const visible = data.invoices.filter((row) => matches(query, row.invoiceNumber, customers.get(row.customerId || ''), row.status, row.dueDate));
  return <div className="workspace-card table-wrap"><table><thead><tr><th>Invoice</th><th>Customer</th><th>Issue date</th><th>Due date</th><th>Total</th><th>Balance</th><th>Status</th></tr></thead><tbody>{visible.map((row) => <tr key={row.id}><td><strong>{row.invoiceNumber}</strong></td><td>{customers.get(row.customerId || '') || 'Unassigned'}</td><td>{row.issueDate || '—'}</td><td>{row.dueDate || '—'}</td><td className="money">{amount(row.total)}</td><td className="money">{amount(row.balanceDue)}</td><td><span className="status-pill">{row.status || 'unknown'}</span></td></tr>)}</tbody></table>{visible.length === 0 && <div className="empty-state"><strong>No receivables</strong><span>No invoice rows match this view.</span></div>}</div>;
}

function BankCash({ data, query }: { data: WorkspaceData; query: string }) {
  const accounts = new Map(data.bankAccounts.map((row) => [row.id, row.displayName]));
  const visible = data.bankTransactions.filter((row) => matches(query, row.postedDate, row.description, row.merchant, accounts.get(row.bankAccountId || ''), row.status));
  return <><div className="metric-grid">{data.bankAccounts.slice(0, 4).map((row) => <article key={row.id}><span>{row.displayName}</span><strong>{amount(row.currentBalance)}</strong><small>{row.connectionState} · {row.currency}</small></article>)}</div><div className="workspace-card table-wrap"><table><thead><tr><th>Date</th><th>Account</th><th>Description</th><th>Merchant</th><th>Amount</th><th>Status</th><th>Evidence</th></tr></thead><tbody>{visible.map((row) => <tr key={row.id}><td>{row.postedDate}</td><td>{accounts.get(row.bankAccountId || '') || '—'}</td><td>{row.description}</td><td>{row.merchant || '—'}</td><td className="money">{amount(row.amount)}</td><td><span className="status-pill">{row.status}</span></td><td>{row.evidenceState}</td></tr>)}</tbody></table>{visible.length === 0 && <div className="empty-state"><strong>No bank transactions</strong><span>No imported transactions match this view.</span></div>}</div></>;
}

function Reconciliation({ data, query }: { data: WorkspaceData; query: string }) {
  const itemsBySession = new Map<string, ReconciliationItemRecord[]>();
  data.reconciliationItems.forEach((item) => itemsBySession.set(item.sessionId, [...(itemsBySession.get(item.sessionId) || []), item]));
  const visible = data.reconciliationSessions.filter((row) => matches(query, row.periodStart, row.periodEnd, row.status, row.readinessScore));
  return <div className="workspace-card table-wrap"><table><thead><tr><th>Period</th><th>Status</th><th>Statement</th><th>Ledger</th><th>Variance</th><th>Readiness</th><th>Exceptions</th></tr></thead><tbody>{visible.map((row) => { const variance = Number(row.statementEndingBalance ?? 0) - Number(row.ledgerEndingBalance ?? 0); const exceptions = (itemsBySession.get(row.id) || []).filter((item) => item.status !== 'resolved').length; return <tr key={row.id}><td>{row.periodStart} → {row.periodEnd}</td><td><span className="status-pill">{row.status}</span></td><td className="money">{amount(row.statementEndingBalance)}</td><td className="money">{amount(row.ledgerEndingBalance)}</td><td className="money">{amount(variance)}</td><td>{row.readinessScore}%</td><td>{exceptions}</td></tr>; })}</tbody></table>{visible.length === 0 && <div className="empty-state"><strong>No reconciliation sessions</strong><span>Create a governed session when statement evidence is available.</span></div>}</div>;
}

function FixedAssets({ rows, query }: { rows: FixedAssetRecord[]; query: string }) {
  const visible = rows.filter((row) => matches(query, row.assetCode, row.name, row.status, row.acquisitionDate));
  return <div className="workspace-card table-wrap"><table><thead><tr><th>Asset</th><th>Name</th><th>Acquired</th><th>Cost</th><th>Salvage</th><th>Life</th><th>Accum. depreciation</th><th>Status</th></tr></thead><tbody>{visible.map((row) => <tr key={row.id}><td>{row.assetCode}</td><td><strong>{row.name}</strong></td><td>{row.acquisitionDate}</td><td className="money">{amount(row.cost)}</td><td className="money">{amount(row.salvageValue)}</td><td>{row.usefulLifeMonths} mo</td><td className="money">{amount(row.accumulatedDepreciation)}</td><td><span className="status-pill">{row.status}</span></td></tr>)}</tbody></table>{visible.length === 0 && <div className="empty-state"><strong>No fixed assets</strong><span>No governed asset records match this view.</span></div>}</div>;
}

function PeriodClose({ data, query }: { data: WorkspaceData; query: string }) {
  const visible = data.closeTasks.filter((row) => matches(query, row.name, row.taskGroup, row.ownerLabel, row.status, row.blocker));
  return <><div className="metric-grid">{data.periods.slice(0, 4).map((row) => <article key={row.id}><span>{row.periodStart} → {row.periodEnd}</span><strong>{row.closeReadiness}%</strong><small>{row.status} · filing {row.filingReadiness}%</small></article>)}</div><div className="workspace-card table-wrap"><table><thead><tr><th>Task</th><th>Group</th><th>Owner</th><th>Status</th><th>Due</th><th>Blocker</th><th>Weight</th></tr></thead><tbody>{visible.map((row) => <tr key={row.id}><td><strong>{row.name}</strong></td><td>{row.taskGroup}</td><td>{row.ownerLabel || 'Unassigned'}</td><td><span className="status-pill">{row.status}</span></td><td>{row.dueAt || '—'}</td><td>{row.blocker || '—'}</td><td>{row.weight}</td></tr>)}</tbody></table>{visible.length === 0 && <div className="empty-state"><strong>No close tasks</strong><span>No close checklist rows match this view.</span></div>}</div></>;
}

function Reports({ data, query }: { data: WorkspaceData; query: string }) {
  const tb = trialBalance(data.accounts, data.journals);
  const pnl = profitAndLoss(data.accounts, data.journals);
  const bs = balanceSheet(data.accounts, data.journals);
  const rows = tb.rows.filter((row) => matches(query, row.accountNumber, row.accountName, row.accountType));
  return <><div className="metric-grid"><article><span>Net income</span><strong>{amount(pnl.netIncome)}</strong><small>Revenue {amount(pnl.totalRevenue)} · Expenses {amount(pnl.totalExpenses)}</small></article><article><span>Total assets</span><strong>{amount(bs.totalAssets)}</strong><small>Balance Sheet {bs.balanced ? 'PASS' : 'FAIL'}</small></article><article><span>Liabilities</span><strong>{amount(bs.totalLiabilities)}</strong><small>Equity {amount(bs.totalEquity)}</small></article><article><span>Trial Balance</span><strong>{tb.balanced ? 'PASS' : 'FAIL'}</strong><small>{amount(tb.totalDebits)} debits / {amount(tb.totalCredits)} credits</small></article></div><div className="workspace-card table-wrap"><table><thead><tr><th>Account</th><th>Name</th><th>Type</th><th>Debits</th><th>Credits</th><th>Balance</th></tr></thead><tbody>{rows.map((row) => <tr key={row.accountId}><td>{row.accountNumber}</td><td>{row.accountName}</td><td>{row.accountType}</td><td className="money">{amount(row.totalDebits)}</td><td className="money">{amount(row.totalCredits)}</td><td className="money">{amount(row.balance)}</td></tr>)}</tbody></table></div></>;
}

function AuditTrail({ rows, query }: { rows: AccountingAuditEvent[]; query: string }) {
  const visible = rows.filter((row) => matches(query, row.createdAt, row.action, row.tableName, row.recordId, row.userId));
  return <div className="workspace-card table-wrap"><table><thead><tr><th>Timestamp</th><th>Action</th><th>Object</th><th>Record</th><th>User</th><th>Before</th><th>After</th></tr></thead><tbody>{visible.map((row) => <tr key={row.id}><td>{row.createdAt || '—'}</td><td><strong>{row.action}</strong></td><td>{row.tableName || '—'}</td><td>{row.recordId || '—'}</td><td>{row.userId || '—'}</td><td><small>{row.oldData == null ? '—' : JSON.stringify(row.oldData)}</small></td><td><small>{row.newData == null ? '—' : JSON.stringify(row.newData)}</small></td></tr>)}</tbody></table>{visible.length === 0 && <div className="empty-state"><strong>No audit events</strong><span>No audit rows match the current view.</span></div>}</div>;
}

function Settings({ data }: { data: WorkspaceData }) {
  const settings = data.settings;
  return <div className="module-grid"><article className="module-card"><span>Fiscal year</span><strong>{settings?.fiscalYearStart || 'Not configured'}</strong><p>Base currency: {settings?.baseCurrency || '—'} · Basis: {settings?.accountingBasis || '—'}</p></article><article className="module-card"><span>Control accounts</span><strong>{settings?.configured ? 'Configured' : 'Configuration required'}</strong><p>AR: {settings?.defaultArAccountId || 'Not assigned'} · AP: {settings?.defaultApAccountId || 'Not assigned'}</p></article></div>;
}

export function AccountingWorkspacePage({ section }: { section: AccountingSection }) {
  const repository = useMemo(() => createAtlasAccountingRepository(), []);
  const [organization, setOrganization] = useState<AtlasOrganization | null>(null);
  const [data, setData] = useState<WorkspaceData>(blankData);
  const [insight, setInsight] = useState<AccountingInsight | null>(null);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setStatus('loading');
    setError('');
    setQuery('');
    void getActiveAtlasOrganization()
      .then(async (org) => {
        const [loaded, ai] = await Promise.all([
          loadSection(repository, org.id, section),
          section === 'dashboard' ? getAccountingInsight(false).catch(() => null) : Promise.resolve(null),
        ]);
        if (!active) return;
        setOrganization(org);
        setData(loaded);
        setInsight(ai);
        setStatus('ready');
      })
      .catch((loadError: unknown) => {
        if (!active) return;
        setOrganization(null);
        setData(blankData());
        setInsight(null);
        setError(loadError instanceof Error ? loadError.message : 'Accounting data could not be loaded');
        setStatus('error');
      });
    return () => { active = false; };
  }, [repository, section]);

  const meta = metadata[section];
  return (
    <section className="page-stack">
      <header className="page-header split-header"><div><p className="eyebrow">ATLAS Finance · Accounting</p><h1>{meta.title}</h1><p>{meta.description}</p></div><div className="asof-card"><span>Organization</span><strong>{organization?.id ? 'Authenticated scope' : 'Session required'}</strong></div></header>
      <AccountingNav active={section} />
      {status === 'loading' && <div className="notice">Loading authenticated accounting data…</div>}
      {status === 'error' && <div className="connection-gate"><strong>Accounting data unavailable</strong><span>{error === 'authentication_required' ? 'Sign in through ATLAS Identity to load organization-scoped accounting data.' : error}</span><Link className="text-link" to={`/identity?app=${encodeURIComponent(`/finance/accounting/${section}`)}`}>Open ATLAS Identity</Link></div>}
      {status === 'ready' && section !== 'dashboard' && section !== 'settings' && <Search value={query} onChange={setQuery} />}
      {status === 'ready' && section === 'dashboard' && <Dashboard data={data} insight={insight} />}
      {status === 'ready' && section === 'chart-of-accounts' && <ChartOfAccounts rows={data.accounts} query={query} />}
      {status === 'ready' && section === 'general-ledger' && <Ledger data={data} query={query} />}
      {status === 'ready' && section === 'journal-entries' && <Journals rows={data.journals} query={query} />}
      {status === 'ready' && section === 'accounts-receivable' && <Receivables data={data} query={query} />}
      {status === 'ready' && section === 'bank-cash' && <BankCash data={data} query={query} />}
      {status === 'ready' && section === 'reconciliation' && <Reconciliation data={data} query={query} />}
      {status === 'ready' && section === 'fixed-assets' && <FixedAssets rows={data.fixedAssets} query={query} />}
      {status === 'ready' && section === 'period-close' && <PeriodClose data={data} query={query} />}
      {status === 'ready' && section === 'reports' && <Reports data={data} query={query} />}
      {status === 'ready' && section === 'audit-trail' && <AuditTrail rows={data.auditEvents} query={query} />}
      {status === 'ready' && section === 'settings' && <Settings data={data} />}
    </section>
  );
}
