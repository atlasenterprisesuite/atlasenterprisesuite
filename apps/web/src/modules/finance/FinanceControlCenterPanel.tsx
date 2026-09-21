import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { loadFinanceControlCenter, type FinanceControlCenterSnapshot } from '../../lib/financeApi';

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const dateTime = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' });

function numeric(value: number | string | null | undefined) {
  const next = Number(value ?? 0);
  return Number.isFinite(next) ? next : 0;
}

function openBalance(rows: Array<{ balance_due: number | string | null; status: string | null }>) {
  return rows
    .filter((row) => !['void', 'cancelled'].includes(String(row.status || '').toLowerCase()))
    .reduce((sum, row) => sum + numeric(row.balance_due), 0);
}

function capabilityValue(available: boolean, value: string) {
  return available ? value : 'Unavailable';
}

export function FinanceControlCenterPanel() {
  const [snapshot, setSnapshot] = useState<FinanceControlCenterSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function refresh() {
    setLoading(true);
    setError('');
    try {
      setSnapshot(await loadFinanceControlCenter());
    } catch (cause) {
      setSnapshot(null);
      setError(cause instanceof Error ? cause.message.replaceAll('_', ' ') : 'Unable to load Finance.');
    } finally {
      setLoading(false);
    }
  }

  const derived = useMemo(() => {
    if (!snapshot) return null;
    const unposted = snapshot.journals.rows.filter((row) => !['posted', 'reversed'].includes(String(row.status || '').toLowerCase())).length;
    const lockedPeriods = snapshot.periods.rows.filter((row) => ['closed', 'locked'].includes(String(row.status || '').toLowerCase())).length;
    const activeBudgets = snapshot.budgets.rows.filter((row) => !['archived'].includes(String(row.status || '').toLowerCase())).length;
    const verifiedFx = snapshot.fxRates.rows.filter((row) => String(row.evidence_state || '').toLowerCase() === 'verified').length;
    const activeConsolidations = snapshot.consolidations.rows.filter((row) => String(row.status || '').toLowerCase() !== 'archived').length;
    const openReconciliations = snapshot.reconciliations.rows.filter((row) => !['reconciled', 'locked'].includes(String(row.status || '').toLowerCase())).length;
    return {
      payableBalance: openBalance(snapshot.payables.rows),
      receivableBalance: openBalance(snapshot.receivables.rows),
      unposted,
      lockedPeriods,
      activeBudgets,
      verifiedFx,
      activeConsolidations,
      openReconciliations
    };
  }, [snapshot]);

  return (
    <section className="module-experience-section" aria-labelledby="finance-control-center-title">
      <div className="module-experience-section-heading">
        <span className="module-experience-index" aria-hidden="true">LIVE</span>
        <div>
          <p className="eyebrow">Authenticated financial state</p>
          <h2 id="finance-control-center-title">Finance Control Center</h2>
          <p>Source-backed visibility across the active organization. Missing schema, RLS access or provider readiness is shown as unavailable instead of being replaced with demo values.</p>
        </div>
      </div>

      <div className="toolbar">
        <div>
          <strong>{snapshot ? 'Supabase RLS · live organization' : 'Finance source'}</strong>
          <p className="muted">{snapshot ? `Loaded ${dateTime.format(new Date(snapshot.loadedAt))}` : loading ? 'Loading authenticated finance state…' : 'No live snapshot loaded.'}</p>
        </div>
        <button className="module-experience-action secondary" type="button" onClick={() => void refresh()} disabled={loading}>
          {loading ? 'Refreshing…' : 'Refresh finance'}
        </button>
      </div>

      {error ? <div className="notice strong" role="alert">{error}</div> : null}

      {snapshot && derived ? (
        <>
          <div className="metric-grid" aria-label="Live Finance summary">
            <article>
              <span>Accounts Payable</span>
              <strong>{capabilityValue(snapshot.payables.available, currency.format(derived.payableBalance))}</strong>
              <small>{snapshot.payables.available ? 'open balance · active organization' : 'accounting_bills unavailable'}</small>
            </article>
            <article>
              <span>Accounts Receivable</span>
              <strong>{capabilityValue(snapshot.receivables.available, currency.format(derived.receivableBalance))}</strong>
              <small>{snapshot.receivables.available ? 'open balance · active organization' : 'invoices unavailable'}</small>
            </article>
            <article>
              <span>Unposted journals</span>
              <strong>{capabilityValue(snapshot.journals.available, String(derived.unposted))}</strong>
              <small>{snapshot.journals.available ? 'journal state from canonical ledger' : 'journal_entries unavailable'}</small>
            </article>
            <article>
              <span>Accounting periods</span>
              <strong>{capabilityValue(snapshot.periods.available, `${derived.lockedPeriods}/${snapshot.periods.rows.length} locked`)}</strong>
              <small>{snapshot.periods.available ? 'close state under accounting controls' : 'accounting_periods unavailable'}</small>
            </article>
          </div>

          <div className="module-experience-grid" aria-label="Finance capability readiness">
            <Link className="module-experience-card is-active" to="/finance/accounting/accounts-payable" aria-label="Open AP workspace">
              <span className="module-experience-card-label">Payables</span>
              <strong>Accounts Payable</strong>
              <p>Vendor obligations, three-way match state, approvals and open balances.</p>
              <span className="module-experience-card-action">Open AP ↗</span>
            </Link>
            <Link className="module-experience-card is-active" to="/finance/accounting/accounts-receivable" aria-label="Open AR workspace">
              <span className="module-experience-card-label">Receivables</span>
              <strong>Accounts Receivable</strong>
              <p>Customer invoicing, collections state, inventory issue and COGS posting.</p>
              <span className="module-experience-card-action">Open AR ↗</span>
            </Link>
            <Link className="module-experience-card is-active" to="/inventory/procure-to-pay" aria-label="Open procure-to-pay workspace">
              <span className="module-experience-card-label">Inventory · AP</span>
              <strong>Procure to Pay</strong>
              <p>PO receiving, packing-slip evidence, three-way match, costing and margin pricing.</p>
              <span className="module-experience-card-action">Open P2P ↗</span>
            </Link>
            <article className="module-experience-card is-gated">
              <span className="module-experience-card-label">Planning</span>
              <strong>Budgeting</strong>
              <p>Budget lifecycle is visible from the organization-scoped accounting backend.</p>
              <small className="module-experience-card-status">{capabilityValue(snapshot.budgets.available, `${derived.activeBudgets} active · ${snapshot.budgets.rows.length} total`)}</small>
            </article>
            <article className="module-experience-card is-gated">
              <span className="module-experience-card-label">Currency</span>
              <strong>FX Registry</strong>
              <p>Registered exchange-rate evidence without implying a live external market provider.</p>
              <small className="module-experience-card-status">{capabilityValue(snapshot.fxRates.available, `${snapshot.fxRates.rows.length} rates · ${derived.verifiedFx} verified`)}</small>
            </article>
            <article className="module-experience-card is-gated">
              <span className="module-experience-card-label">Group reporting</span>
              <strong>Consolidation</strong>
              <p>Organization-scoped consolidation groups with intercompany governance.</p>
              <small className="module-experience-card-status">{capabilityValue(snapshot.consolidations.available, `${derived.activeConsolidations} active groups`)}</small>
            </article>
            <article className="module-experience-card is-gated">
              <span className="module-experience-card-label">Cash controls</span>
              <strong>Bank & Reconciliation</strong>
              <p>Registered bank and reconciliation state only. No banking connection is claimed from this screen.</p>
              <small className="module-experience-card-status">
                {snapshot.bankAccounts.available && snapshot.reconciliations.available
                  ? `${snapshot.bankAccounts.rows.length} bank records · ${derived.openReconciliations} open reconciliations`
                  : 'Unavailable'}
              </small>
            </article>
            <Link className="module-experience-card is-active" to="/finance/accounting/reports/automotive-sales" aria-label="Open automotive finance report">
              <span className="module-experience-card-label">Reporting</span>
              <strong>Automotive Sales</strong>
              <p>Departmental financial reporting across vehicle, F&I, fixed ops, inventory and floorplan.</p>
              <span className="module-experience-card-action">Open report ↗</span>
            </Link>
          </div>

          <div className="notice" role="note">
            Financial mutations remain inside their existing governed workflows. This control center reads live state; it does not auto-post journals, close periods, move cash or execute bank payments.
          </div>
        </>
      ) : loading ? (
        <div className="empty-state" role="status">
          <strong>Loading Finance Control Center…</strong>
          <span>Reading the active organization through the existing ATLAS session and Supabase RLS.</span>
        </div>
      ) : (
        <div className="empty-state" role="status">
          <strong>Live Finance snapshot ready to load</strong>
          <span>Use Refresh finance to read the active organization. No financial totals are requested until you explicitly open the live snapshot.</span>
        </div>
      )}
    </section>
  );
}
