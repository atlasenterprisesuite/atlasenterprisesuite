import { useMemo, useState } from 'react';
import { loadFpaWorkspace, type FpaWorkspaceSnapshot } from '../../lib/financeApi';

function numeric(value: number | string) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
}

function formatMoney(value: number, currency: string) {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);
  } catch {
    return String(value);
  }
}

export function FpaControlCenterPanel() {
  const [snapshot, setSnapshot] = useState<FpaWorkspaceSnapshot | null>(null);
  const [selectedBudgetId, setSelectedBudgetId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function refresh() {
    setLoading(true);
    setError('');
    try {
      const next = await loadFpaWorkspace();
      setSnapshot(next);
      if (!next.budgets.some((budget) => budget.id === selectedBudgetId)) {
        setSelectedBudgetId(next.budgets[0]?.id || '');
      }
    } catch (cause) {
      setSnapshot(null);
      setError(cause instanceof Error ? cause.message.replaceAll('_', ' ') : 'FP&A workspace unavailable.');
    } finally {
      setLoading(false);
    }
  }

  const selected = snapshot?.budgets.find((budget) => budget.id === selectedBudgetId) ?? null;
  const summary = useMemo(() => {
    if (!snapshot || !selected) return null;
    const lines = snapshot.lines.filter((line) => line.budget_id === selected.id);
    return {
      lineCount: lines.length,
      budgetTotal: lines.reduce((sum, line) => sum + numeric(line.amount), 0),
      periods: new Set(lines.map((line) => line.period_start)).size,
      dimensions: lines.filter((line) => line.dimension && Object.keys(line.dimension).length > 0).length
    };
  }, [snapshot, selected]);

  return (
    <section className="module-experience-section" aria-labelledby="fpa-control-center-title">
      <div className="module-experience-section-heading">
        <span className="module-experience-index" aria-hidden="true">FP&A</span>
        <div>
          <p className="eyebrow">Financial planning & analysis</p>
          <h2 id="fpa-control-center-title">Budget & Scenario Control Center</h2>
          <p>Organization-scoped budget versions and planning lines from the canonical accounting backend. No forecast or actual variance is fabricated when source evidence is absent.</p>
        </div>
      </div>

      <div className="toolbar">
        <div>
          <strong>{snapshot ? 'Supabase RLS · planning state' : 'FP&A source'}</strong>
          <p className="muted">{snapshot ? `${snapshot.budgets.length} budget version(s) available` : 'No planning snapshot loaded.'}</p>
        </div>
        <button className="module-experience-action secondary" type="button" onClick={() => void refresh()} disabled={loading}>
          {loading ? 'Refreshing…' : 'Refresh FP&A'}
        </button>
      </div>

      {error ? <div className="notice strong" role="alert">{error}</div> : null}

      {snapshot ? (
        snapshot.budgets.length ? (
          <>
            <div className="toolbar">
              <label>
                <span>Budget / scenario</span>
                <select value={selectedBudgetId} onChange={(event) => setSelectedBudgetId(event.target.value)}>
                  {snapshot.budgets.map((budget) => (
                    <option key={budget.id} value={budget.id}>
                      {budget.name} · FY{budget.fiscal_year} · v{budget.version} · {budget.scenario} · {budget.status}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {selected && summary ? (
              <>
                <div className="metric-grid" aria-label="FP&A planning summary">
                  <article><span>Budget total</span><strong>{formatMoney(summary.budgetTotal, selected.base_currency)}</strong><small>stored planning lines</small></article>
                  <article><span>Scenario</span><strong>{selected.scenario}</strong><small>version {selected.version}</small></article>
                  <article><span>Periods</span><strong>{summary.periods}</strong><small>{summary.lineCount} planning lines</small></article>
                  <article><span>Status</span><strong>{selected.status || 'unknown'}</strong><small>{summary.dimensions} dimensioned lines</small></article>
                </div>
                <div className="notice" role="note">
                  Budget lifecycle remains governed by accounting permissions: draft versions may change; approved and locked versions retain the existing immutability controls. Actual-vs-budget and rolling forecast remain fail-closed until canonical actual and forecast contracts are wired.
                </div>
              </>
            ) : null}
          </>
        ) : (
          <div className="empty-state"><strong>No budget versions found</strong><span>Create planning data through the governed Accounting workflow; ATLAS will not manufacture planning totals.</span></div>
        )
      ) : (
        <div className="empty-state"><strong>FP&A snapshot ready to load</strong><span>Refresh to read budget versions and lines for the active organization.</span></div>
      )}
    </section>
  );
}
