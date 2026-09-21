import { FormEvent, useEffect, useMemo, useState } from 'react';
import { demoAtlasContext, hasPermission } from '../../../../../../packages/core/src';
import {
  agingBucket,
  effectiveStatus,
  filterBills,
  openBalance,
  scopePayablesData,
  summarizeAging,
  summarizePayables,
  type Bill,
  type BillStatus,
  type DueWindow
} from '../../../../../../packages/accounting/src';
import {
  bills as demoBills,
  payablesAsOf,
  payablesDemoNotice,
  paymentApplications as demoPaymentApplications,
  vendors as demoVendors
} from '../../../../../../data/demo/accounting/payablesSeed';
import {
  ATLAS_SESSION_EVENT,
  clearAtlasSession,
  getAccountingInsight,
  getAtlasAccessToken,
  getLivePayablesLedger,
  signInAtlas,
  type AccountingInsight,
  type LivePayableBill,
  type LivePayablesLedger
} from '../../../lib/atlasSession';

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const date = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const dateTime = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' });
const scopedData = scopePayablesData(
  demoAtlasContext.scope,
  demoVendors,
  demoBills,
  demoPaymentApplications
);
const bills = scopedData.bills;
const vendors = scopedData.vendors;
const paymentApplications = scopedData.paymentApplications;

function vendorFor(bill: Bill) {
  return vendors.find((vendor) => vendor.id === bill.vendorId);
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'Not set';
  return date.format(new Date(`${value}T00:00:00Z`));
}

function InsightBody({ text }: { text: string }) {
  return (
    <div className="ai-insight-copy">
      {text.split('\n').filter(Boolean).map((line, index) => {
        if (line.startsWith('## ')) return <h3 key={`${line}-${index}`}>{line.slice(3)}</h3>;
        if (line.startsWith('- ')) return <p key={`${line}-${index}`} className="ai-insight-bullet">{line.slice(2)}</p>;
        return <p key={`${line}-${index}`}>{line}</p>;
      })}
    </div>
  );
}

function LiveAccountingInsight() {
  const [hasSession, setHasSession] = useState(() => Boolean(getAtlasAccessToken()));
  const [insight, setInsight] = useState<AccountingInsight | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  async function loadInsight(forceRefresh = false) {
    setLoading(true);
    setError('');
    try {
      const next = await getAccountingInsight(forceRefresh);
      setInsight(next);
      setHasSession(true);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Unable to load live accounting intelligence.';
      if (message === 'authentication_required' || message === 'session_expired' || message === 'invalid_session') {
        clearAtlasSession();
        setHasSession(false);
        setInsight(null);
      }
      setError(message.replaceAll('_', ' '));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (hasSession && !insight && !loading) void loadInsight(false);
  }, [hasSession]);

  async function handleSignIn(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      await signInAtlas(email.trim(), password);
      setPassword('');
      setHasSession(true);
      const next = await getAccountingInsight(false);
      setInsight(next);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Sign in failed.');
    } finally {
      setLoading(false);
    }
  }

  function handleSignOut() {
    clearAtlasSession();
    setInsight(null);
    setHasSession(false);
    setError('');
  }

  return (
    <section className="ai-insight-card" aria-label="ATLAS Astra Accounts Payable intelligence">
      <div className="ai-insight-heading">
        <div>
          <p className="eyebrow">ATLAS Intelligence / Live RLS data</p>
          <h2>Astra AP Intelligence</h2>
          <p>Reads the authenticated organization snapshot in Supabase and recommends controls without executing payments or journal entries.</p>
        </div>
        {insight && <span className="status-pill">{insight.cached ? 'Cached snapshot' : 'Fresh analysis'} · {insight.model}</span>}
      </div>

      {!hasSession ? (
        <form className="ai-session-form" onSubmit={handleSignIn}>
          <div>
            <strong>Live ATLAS session required</strong>
            <p>Sign in to load the organization-scoped AP snapshot and ledger under Supabase RLS.</p>
          </div>
          <label className="field"><span>Email</span><input type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
          <label className="field"><span>Password</span><input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
          <button className="primary-action" type="submit" disabled={loading}>{loading ? 'Signing in…' : 'Sign in & analyze'}</button>
        </form>
      ) : (
        <>
          <div className="ai-insight-actions">
            <button className="primary-action" type="button" onClick={() => void loadInsight(true)} disabled={loading}>{loading ? 'Analyzing…' : 'Refresh analysis'}</button>
            <button className="link-button" type="button" onClick={handleSignOut}>Sign out</button>
          </div>

          {insight && (
            <>
              <div className="ai-insight-metrics" aria-label="Live AP snapshot summary">
                <article><span>Live bills</span><strong>{insight.snapshot.bill_count}</strong></article>
                <article><span>Open balance</span><strong>{currency.format(insight.snapshot.open_balance)}</strong></article>
                <article><span>Chart accounts</span><strong>{insight.snapshot.chart_account_count}</strong></article>
                <article><span>Generated</span><strong>{dateTime.format(new Date(insight.generated_at))}</strong></article>
              </div>
              <InsightBody text={insight.analysis} />
              <div className="ai-execution-boundary">
                <strong>Execution boundary</strong>
                <span>Recommendations only · payments {insight.execution.payments ? 'enabled' : 'not executed'} · journal entries {insight.execution.journal_entries ? 'enabled' : 'not executed'} · mutations {insight.execution.mutations ? 'enabled' : 'disabled'}</span>
              </div>
            </>
          )}
        </>
      )}

      {loading && hasSession && !insight && <div className="empty-state"><strong>Analyzing live AP data…</strong><span>ATLAS is reading the RLS-scoped accounting snapshot.</span></div>}
      {error && <div className="notice" role="alert">{error}</div>}
      <small className="muted">The intelligence panel and AP ledger use the same authenticated Supabase organization scope. Demo data is shown only when there is no ATLAS session.</small>
    </section>
  );
}

function LivePayablesLedgerView() {
  const [ledger, setLedger] = useState<LivePayablesLedger | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [sort, setSort] = useState<'billDate' | 'balance' | 'vendor'>('billDate');
  const [selectedId, setSelectedId] = useState('');

  async function loadLedger() {
    if (!getAtlasAccessToken()) {
      setLedger(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const next = await getLivePayablesLedger();
      setLedger(next);
      setSelectedId((current) => current || next.bills[0]?.id || '');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message.replaceAll('_', ' ') : 'Unable to load the live AP ledger.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadLedger();
    const handleSession = () => void loadLedger();
    window.addEventListener(ATLAS_SESSION_EVENT, handleSession);
    window.addEventListener('storage', handleSession);
    return () => {
      window.removeEventListener(ATLAS_SESSION_EVENT, handleSession);
      window.removeEventListener('storage', handleSession);
    };
  }, []);

  const visibleBills = useMemo(() => {
    if (!ledger) return [];
    const normalizedQuery = query.trim().toLowerCase();
    const filtered = ledger.bills.filter((bill) => {
      const matchesQuery = !normalizedQuery || [bill.bill_number, bill.vendor?.name, bill.approval_state, bill.match_state]
        .some((value) => String(value || '').toLowerCase().includes(normalizedQuery));
      const matchesStatus = status === 'all' || bill.status === status;
      return matchesQuery && matchesStatus;
    });
    return [...filtered].sort((a, b) => {
      if (sort === 'balance') return b.balance_due - a.balance_due;
      if (sort === 'vendor') return (a.vendor?.name || '').localeCompare(b.vendor?.name || '');
      return b.bill_date.localeCompare(a.bill_date);
    });
  }, [ledger, query, status, sort]);

  if (loading && !ledger) return <div className="empty-state"><strong>Loading live Accounts Payable…</strong><span>Reading Supabase under the active organization session.</span></div>;
  if (error && !ledger) return <div className="notice" role="alert">{error}</div>;
  if (!ledger) return null;

  const totalOpen = ledger.bills.reduce((sum, bill) => sum + bill.balance_due, 0);
  const openCount = ledger.bills.filter((bill) => bill.status !== 'paid' && bill.balance_due > 0).length;
  const exceptions = ledger.bills.filter((bill) => bill.match_state === 'exception' || bill.match_state === 'no_po' || bill.approval_state === 'on_hold').length;
  const missingDueDates = ledger.bills.filter((bill) => !bill.due_date && bill.balance_due > 0).length;
  const selected: LivePayableBill | undefined = visibleBills.find((bill) => bill.id === selectedId) || visibleBills[0];
  const statuses = Array.from(new Set(ledger.bills.map((bill) => bill.status))).sort();

  return (
    <>
      <div className="notice live-data-notice" role="status">
        Live Supabase ledger · RLS protected · {ledger.bills.length} bill{ledger.bills.length === 1 ? '' : 's'} visible to the active organization · role {ledger.organization.role}
      </div>

      <section className="metric-grid" aria-label="Live payables summary">
        <article><span>Total open</span><strong>{currency.format(totalOpen)}</strong><small>Live RLS-scoped balance</small></article>
        <article><span>Open bills</span><strong>{openCount}</strong><small>{ledger.bills.length} total visible</small></article>
        <article><span>Control exceptions</span><strong>{exceptions}</strong><small>PO, match, or approval review</small></article>
        <article><span>Missing due dates</span><strong>{missingDueDates}</strong><small>Blocks reliable aging</small></article>
      </section>

      <section className="workspace-card">
        <div className="toolbar live-toolbar">
          <label className="field wide-field">
            <span>Search live AP</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Vendor, bill, approval, match state" />
          </label>
          <label className="field">
            <span>Status</span>
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="all">All statuses</option>
              {statuses.map((value) => <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Sort</span>
            <select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)}>
              <option value="billDate">Bill date</option>
              <option value="balance">Open balance</option>
              <option value="vendor">Vendor</option>
            </select>
          </label>
        </div>

        {visibleBills.length === 0 ? (
          <div className="empty-state"><strong>No live bills match these filters</strong><span>Change search or status filters.</span></div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Vendor</th><th>Bill</th><th>Bill date</th><th>Due</th><th>Status</th><th>Approval</th><th>Match</th><th>Open balance</th><th /></tr></thead>
              <tbody>
                {visibleBills.map((bill) => (
                  <tr key={bill.id} className={selected?.id === bill.id ? 'selected-row' : undefined}>
                    <td><strong>{bill.vendor?.name || 'Vendor not identified'}</strong><small>{bill.vendor?.status || 'No vendor record'}</small></td>
                    <td><strong>{bill.bill_number}</strong><small>{currency.format(bill.amount)} original</small></td>
                    <td>{formatDate(bill.bill_date)}</td>
                    <td>{formatDate(bill.due_date)}</td>
                    <td><span className={`status-pill ${bill.status}`}>{bill.status.replaceAll('_', ' ')}</span></td>
                    <td><span className="approval-chip">{bill.approval_state.replaceAll('_', ' ')}</span></td>
                    <td><span className="approval-chip">{bill.match_state.replaceAll('_', ' ')}</span></td>
                    <td className="money">{currency.format(bill.balance_due)}</td>
                    <td><button className="link-button" onClick={() => setSelectedId(bill.id)}>Open</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selected && (
        <section className="detail-panel" aria-label="Selected live bill detail">
          <div className="detail-heading">
            <div><p className="eyebrow">Live bill detail</p><h2>{selected.bill_number}</h2><span>{selected.vendor?.name || 'Vendor not identified'}</span></div>
            <div className="detail-balance"><span>Open balance</span><strong>{currency.format(selected.balance_due)}</strong></div>
          </div>
          <div className="detail-grid">
            <dl><dt>Bill date</dt><dd>{formatDate(selected.bill_date)}</dd></dl>
            <dl><dt>Due date</dt><dd>{formatDate(selected.due_date)}</dd></dl>
            <dl><dt>Approval</dt><dd>{selected.approval_state.replaceAll('_', ' ')}</dd></dl>
            <dl><dt>Match state</dt><dd>{selected.match_state.replaceAll('_', ' ')}</dd></dl>
            <dl><dt>Status</dt><dd>{selected.status.replaceAll('_', ' ')}</dd></dl>
            <dl><dt>Original amount</dt><dd>{currency.format(selected.amount)}</dd></dl>
          </div>
          <div className="payment-history">
            <div><h3>Vendor contact</h3><p>Live vendor directory values visible under the same organization scope.</p></div>
            <article><span>Email</span><strong>{selected.vendor?.email || 'Not set'}</strong><small>{selected.vendor?.status || 'Unknown status'}</small></article>
            <article><span>Phone</span><strong>{selected.vendor?.phone || 'Not set'}</strong><small>Vendor ID {selected.vendor_id || selected.purchasing_vendor_id || 'not linked'}</small></article>
          </div>
          <div className="connection-gate"><strong>Governed AP execution</strong><span>This ledger remains read-only for payment and approval mutations. PO/packing-slip matched bills created through Procure to Pay already carry their governed Inventory/AP journal posting; ACH, check and card rails remain provider-gated.</span></div>
        </section>
      )}

      {error && <div className="notice" role="alert">{error}</div>}
    </>
  );
}

function DemoPayablesLedger() {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<BillStatus | 'all'>('all');
  const [dueWindow, setDueWindow] = useState<DueWindow>('all');
  const [sort, setSort] = useState<'dueDate' | 'balance' | 'vendor'>('dueDate');
  const [selectedId, setSelectedId] = useState(bills[0]?.id ?? '');

  const summary = useMemo(() => summarizePayables(bills, payablesAsOf), []);
  const aging = useMemo(() => summarizeAging(bills, payablesAsOf), []);
  const visibleBills = useMemo(() => {
    const filtered = filterBills(bills, vendors, { query, status, dueWindow }, payablesAsOf);
    return [...filtered].sort((a, b) => {
      if (sort === 'balance') return openBalance(b) - openBalance(a);
      if (sort === 'vendor') return (vendorFor(a)?.name ?? '').localeCompare(vendorFor(b)?.name ?? '');
      return a.dueDate.localeCompare(b.dueDate);
    });
  }, [query, status, dueWindow, sort]);

  const selected = visibleBills.find((bill) => bill.id === selectedId) ?? visibleBills[0];
  const selectedVendor = selected ? vendorFor(selected) : undefined;
  const selectedPayments = selected ? paymentApplications.filter((payment) => payment.billId === selected.id) : [];

  return (
    <>
      <div className="notice" role="status">{payablesDemoNotice}</div>
      <section className="metric-grid" aria-label="Demo payables summary">
        <article><span>Total open</span><strong>{currency.format(summary.totalOpen)}</strong><small>{summary.openCount} demo open bills</small></article>
        <article><span>Overdue</span><strong>{currency.format(summary.overdue)}</strong><small>Demo data</small></article>
        <article><span>Pending approval</span><strong>{currency.format(summary.pendingApproval)}</strong><small>Demo approval state</small></article>
        <article><span>Payment execution</span><strong>Not connected</strong><small>No banking rail configured</small></article>
      </section>
      <section className="aging-strip" aria-label="Demo accounts payable aging">
        {Object.entries(aging).map(([bucket, amount]) => <article key={bucket}><span>{bucket === 'current' ? 'Current' : `${bucket} days`}</span><strong>{currency.format(amount)}</strong></article>)}
      </section>
      <section className="workspace-card">
        <div className="toolbar">
          <label className="field wide-field"><span>Search demo</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Vendor, code, bill, description" /></label>
          <label className="field"><span>Status</span><select value={status} onChange={(event) => setStatus(event.target.value as BillStatus | 'all')}><option value="all">All statuses</option><option value="open">Open</option><option value="partially_paid">Partially paid</option><option value="overdue">Overdue</option><option value="paid">Paid</option><option value="draft">Draft</option></select></label>
          <label className="field"><span>Due</span><select value={dueWindow} onChange={(event) => setDueWindow(event.target.value as DueWindow)}><option value="all">All dates</option><option value="overdue">Overdue</option><option value="7">Next 7 days</option><option value="30">Next 30 days</option></select></label>
          <label className="field"><span>Sort</span><select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)}><option value="dueDate">Due date</option><option value="balance">Open balance</option><option value="vendor">Vendor</option></select></label>
        </div>
        {visibleBills.length === 0 ? <div className="empty-state"><strong>No demo bills match these filters</strong><span>Change search, status, or due-date filters.</span></div> : (
          <div className="table-wrap"><table><thead><tr><th>Vendor</th><th>Bill</th><th>Due</th><th>Status</th><th>Approval</th><th>Open balance</th><th>Aging</th><th /></tr></thead><tbody>
            {visibleBills.map((bill) => {
              const vendor = vendorFor(bill);
              const billStatus = effectiveStatus(bill, payablesAsOf);
              return <tr key={bill.id} className={selected?.id === bill.id ? 'selected-row' : undefined}><td><strong>{vendor?.name ?? 'Unknown vendor'}</strong><small>{vendor?.vendorCode}</small></td><td><strong>{bill.billNumber}</strong><small>{bill.description}</small></td><td>{formatDate(bill.dueDate)}</td><td><span className={`status-pill ${billStatus}`}>{billStatus.replace('_', ' ')}</span></td><td><span className="approval-chip">{bill.approvalStatus.replace('_', ' ')}</span></td><td className="money">{currency.format(openBalance(bill))}</td><td>{openBalance(bill) === 0 ? 'Settled' : agingBucket(bill, payablesAsOf)}</td><td><button className="link-button" onClick={() => setSelectedId(bill.id)}>Open</button></td></tr>;
            })}
          </tbody></table></div>
        )}
      </section>
      {selected && (
        <section className="detail-panel" aria-label="Selected demo bill detail">
          <div className="detail-heading"><div><p className="eyebrow">Demo bill detail</p><h2>{selected.billNumber}</h2><span>{selectedVendor?.name}</span></div><div className="detail-balance"><span>Open balance</span><strong>{currency.format(openBalance(selected))}</strong></div></div>
          <div className="detail-grid"><dl><dt>Issue date</dt><dd>{formatDate(selected.issueDate)}</dd></dl><dl><dt>Due date</dt><dd>{formatDate(selected.dueDate)}</dd></dl><dl><dt>Terms</dt><dd>{selectedVendor?.paymentTerms ?? 'Not set'}</dd></dl><dl><dt>Approval</dt><dd>{selected.approvalStatus.replace('_', ' ')}</dd></dl><dl><dt>Journal reference</dt><dd>{selected.journalEntryId ?? 'Not linked'}</dd></dl><dl><dt>Original amount</dt><dd>{currency.format(selected.totalAmount)}</dd></dl></div>
          <div className="payment-history"><div><h3>Payment application history</h3><p>Historical applications in the demo ledger only.</p></div>{selectedPayments.length === 0 ? <span className="muted">No payment applications</span> : selectedPayments.map((payment) => <article key={payment.id}><span>{formatDate(payment.appliedAt)}</span><strong>{currency.format(payment.amount)}</strong><small>{payment.reference}</small></article>)}</div>
        </section>
      )}
    </>
  );
}

function PayablesWorkspace() {
  const [hasLiveSession, setHasLiveSession] = useState(() => Boolean(getAtlasAccessToken()));

  useEffect(() => {
    const syncSession = () => setHasLiveSession(Boolean(getAtlasAccessToken()));
    window.addEventListener(ATLAS_SESSION_EVENT, syncSession);
    window.addEventListener('storage', syncSession);
    return () => {
      window.removeEventListener(ATLAS_SESSION_EVENT, syncSession);
      window.removeEventListener('storage', syncSession);
    };
  }, []);

  return (
    <div className="page-stack">
      <header className="page-header split-header">
        <div>
          <p className="eyebrow">Finance / Accounting</p>
          <h1>Accounts Payable</h1>
          <p>Live vendor obligations, approval controls, matching exceptions, balances, and Astra accounting intelligence under one organization-scoped session.</p>
        </div>
        <div className="asof-card"><span>Data source</span><strong>{hasLiveSession ? 'Supabase Live' : 'Demo fallback'}</strong></div>
      </header>

      <LiveAccountingInsight />
      {hasLiveSession ? <LivePayablesLedgerView /> : <DemoPayablesLedger />}
    </div>
  );
}

export function PayablesPage() {
  if (!hasPermission(demoAtlasContext.permissions, 'accounting.read')) {
    return (
      <section className="page-stack">
        <header className="page-header">
          <p className="eyebrow">Finance / Accounting</p>
          <h1>Access denied</h1>
          <p>Your current ATLAS role does not include permission to read Accounts Payable.</p>
        </header>
      </section>
    );
  }

  return <PayablesWorkspace />;
}
