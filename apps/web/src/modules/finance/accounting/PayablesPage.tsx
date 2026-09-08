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
  clearAtlasSession,
  getAccountingInsight,
  getAtlasAccessToken,
  signInAtlas,
  type AccountingInsight
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
        {insight && <span className="status-chip neutral">{insight.cached ? 'Cached snapshot' : 'Fresh analysis'} · {insight.model}</span>}
      </div>

      {!hasSession ? (
        <form className="ai-session-form" onSubmit={handleSignIn}>
          <div>
            <strong>Live ATLAS session required</strong>
            <p>Sign in to load the organization-scoped AP snapshot under Supabase RLS.</p>
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
      <small className="muted">The intelligence panel is live. The AP ledger table below remains the repository demo dataset until its separate live-data cutover is completed.</small>
    </section>
  );
}

function PayablesWorkspace() {
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
  const selectedPayments = selected
    ? paymentApplications.filter((payment) => payment.billId === selected.id)
    : [];

  return (
    <div className="page-stack">
      <header className="page-header split-header">
        <div>
          <p className="eyebrow">Finance / Accounting</p>
          <h1>Accounts Payable</h1>
          <p>Vendor obligations, aging, approval state, payment application history, and accounting references from one governed dataset.</p>
        </div>
        <div className="asof-card"><span>As of</span><strong>{date.format(new Date(`${payablesAsOf}T00:00:00Z`))}</strong></div>
      </header>

      <LiveAccountingInsight />

      <div className="notice" role="status">{payablesDemoNotice}</div>

      <section className="metric-grid" aria-label="Payables summary">
        <article><span>Total open</span><strong>{currency.format(summary.totalOpen)}</strong><small>{summary.openCount} open bills</small></article>
        <article><span>Overdue</span><strong>{currency.format(summary.overdue)}</strong><small>Requires review</small></article>
        <article><span>Pending approval</span><strong>{currency.format(summary.pendingApproval)}</strong><small>Approval state only</small></article>
        <article><span>Payment execution</span><strong>Not connected</strong><small>No banking rail configured</small></article>
      </section>

      <section className="aging-strip" aria-label="Accounts payable aging">
        {Object.entries(aging).map(([bucket, amount]) => (
          <article key={bucket}><span>{bucket === 'current' ? 'Current' : `${bucket} days`}</span><strong>{currency.format(amount)}</strong></article>
        ))}
      </section>

      <section className="workspace-card">
        <div className="toolbar">
          <label className="field wide-field">
            <span>Search</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Vendor, code, bill, description" />
          </label>
          <label className="field">
            <span>Status</span>
            <select value={status} onChange={(event) => setStatus(event.target.value as BillStatus | 'all')}>
              <option value="all">All statuses</option>
              <option value="open">Open</option>
              <option value="partially_paid">Partially paid</option>
              <option value="overdue">Overdue</option>
              <option value="paid">Paid</option>
              <option value="draft">Draft</option>
            </select>
          </label>
          <label className="field">
            <span>Due</span>
            <select value={dueWindow} onChange={(event) => setDueWindow(event.target.value as DueWindow)}>
              <option value="all">All dates</option>
              <option value="overdue">Overdue</option>
              <option value="7">Next 7 days</option>
              <option value="30">Next 30 days</option>
            </select>
          </label>
          <label className="field">
            <span>Sort</span>
            <select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)}>
              <option value="dueDate">Due date</option>
              <option value="balance">Open balance</option>
              <option value="vendor">Vendor</option>
            </select>
          </label>
        </div>

        {visibleBills.length === 0 ? (
          <div className="empty-state"><strong>No bills match these filters</strong><span>Change search, status, or due-date filters.</span></div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Vendor</th><th>Bill</th><th>Due</th><th>Status</th><th>Approval</th><th>Open balance</th><th>Aging</th><th /></tr></thead>
              <tbody>
                {visibleBills.map((bill) => {
                  const vendor = vendorFor(bill);
                  const billStatus = effectiveStatus(bill, payablesAsOf);
                  return (
                    <tr key={bill.id} className={selected?.id === bill.id ? 'selected-row' : undefined}>
                      <td><strong>{vendor?.name ?? 'Unknown vendor'}</strong><small>{vendor?.vendorCode}</small></td>
                      <td><strong>{bill.billNumber}</strong><small>{bill.description}</small></td>
                      <td>{date.format(new Date(`${bill.dueDate}T00:00:00Z`))}</td>
                      <td><span className={`status-pill ${billStatus}`}>{billStatus.replace('_', ' ')}</span></td>
                      <td><span className="approval-chip">{bill.approvalStatus.replace('_', ' ')}</span></td>
                      <td className="money">{currency.format(openBalance(bill))}</td>
                      <td>{openBalance(bill) === 0 ? 'Settled' : agingBucket(bill, payablesAsOf)}</td>
                      <td><button className="link-button" onClick={() => setSelectedId(bill.id)}>Open</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selected && (
        <section className="detail-panel" aria-label="Selected bill detail">
          <div className="detail-heading">
            <div><p className="eyebrow">Bill detail</p><h2>{selected.billNumber}</h2><span>{selectedVendor?.name}</span></div>
            <div className="detail-balance"><span>Open balance</span><strong>{currency.format(openBalance(selected))}</strong></div>
          </div>
          <div className="detail-grid">
            <dl><dt>Issue date</dt><dd>{date.format(new Date(`${selected.issueDate}T00:00:00Z`))}</dd></dl>
            <dl><dt>Due date</dt><dd>{date.format(new Date(`${selected.dueDate}T00:00:00Z`))}</dd></dl>
            <dl><dt>Terms</dt><dd>{selectedVendor?.paymentTerms ?? 'Not set'}</dd></dl>
            <dl><dt>Approval</dt><dd>{selected.approvalStatus.replace('_', ' ')}</dd></dl>
            <dl><dt>Journal reference</dt><dd>{selected.journalEntryId ?? 'Not linked'}</dd></dl>
            <dl><dt>Original amount</dt><dd>{currency.format(selected.totalAmount)}</dd></dl>
          </div>
          <div className="payment-history">
            <div><h3>Payment application history</h3><p>Historical applications in the demo ledger only. This does not execute payments.</p></div>
            {selectedPayments.length === 0 ? <span className="muted">No payment applications</span> : selectedPayments.map((payment) => (
              <article key={payment.id}><span>{date.format(new Date(`${payment.appliedAt}T00:00:00Z`))}</span><strong>{currency.format(payment.amount)}</strong><small>{payment.reference}</small></article>
            ))}
          </div>
          <div className="connection-gate"><strong>Payment rail required</strong><span>ACH, check, card, or bank execution remains unavailable until an authorized integration and backend authorization gate are configured.</span></div>
        </section>
      )}
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
