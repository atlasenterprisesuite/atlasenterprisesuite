import { useMemo, useState } from 'react';
import { loadIntercompanyWorkspace, type IntercompanyWorkspaceSnapshot } from '../../lib/financeApi';

function money(value: number | string, currency: string) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return 'Unavailable';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
}

export function EnterpriseAccountingPanel() {
  const [groupId, setGroupId] = useState('');
  const [snapshot, setSnapshot] = useState<IntercompanyWorkspaceSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function refresh() {
    if (!groupId.trim()) {
      setError('Select or enter a consolidation group before loading intercompany evidence.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      setSnapshot(await loadIntercompanyWorkspace(groupId.trim()));
    } catch (cause) {
      setSnapshot(null);
      setError(cause instanceof Error ? cause.message.replaceAll('_', ' ') : 'Intercompany workspace unavailable.');
    } finally {
      setLoading(false);
    }
  }

  const summary = useMemo(() => {
    const rows = snapshot?.candidates ?? [];
    return {
      total: rows.length,
      matched: rows.filter((row) => row.latest_match_status === 'matched').length,
      exceptions: rows.filter((row) => row.latest_match_status === 'exception').length,
      eliminated: rows.filter((row) => row.latest_match_status === 'eliminated').length,
      unmatched: rows.filter((row) => !row.latest_match_status).length
    };
  }, [snapshot]);

  return (
    <section className="module-experience-section" aria-labelledby="enterprise-accounting-title">
      <div className="module-experience-section-heading">
        <span className="module-experience-index" aria-hidden="true">GROUP</span>
        <div>
          <p className="eyebrow">Enterprise Accounting</p>
          <h2 id="enterprise-accounting-title">Intercompany & Consolidation Workspace</h2>
          <p>Reads posted journal evidence through the canonical Supabase RLS contract. It does not infer matches, eliminations, FX evidence or posting state.</p>
        </div>
      </div>

      <div className="toolbar">
        <label>
          <span>Consolidation group UUID</span>
          <input value={groupId} onChange={(event) => setGroupId(event.target.value)} placeholder="Select group" autoComplete="off" />
        </label>
        <button className="module-experience-action secondary" type="button" onClick={() => void refresh()} disabled={loading}>
          {loading ? 'Loading…' : 'Load intercompany evidence'}
        </button>
      </div>

      {error ? <div className="notice strong" role="alert">{error}</div> : null}

      {snapshot ? (
        <>
          <div className="metric-grid" aria-label="Intercompany evidence summary">
            <article><span>Candidates</span><strong>{summary.total}</strong><small>posted journal lines</small></article>
            <article><span>Unmatched</span><strong>{summary.unmatched}</strong><small>requires review</small></article>
            <article><span>Matched</span><strong>{summary.matched}</strong><small>governed matches</small></article>
            <article><span>Exceptions</span><strong>{summary.exceptions}</strong><small>not eligible for silent elimination</small></article>
          </div>
          <div className="notice" role="note">
            Eliminated: {summary.eliminated}. Mutations remain governed by existing accounting permissions, immutable match evidence and balanced consolidation-adjustment controls.
          </div>
          {snapshot.candidates.length ? (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Entity</th><th>Journal</th><th>Account</th><th>Reporting amount</th><th>State</th></tr></thead>
                <tbody>
                  {snapshot.candidates.slice(0, 50).map((row) => (
                    <tr key={row.line_id}>
                      <td>{row.entity_code} · {row.entity_name}</td>
                      <td>{row.entry_number}<br /><small>{row.entry_date}</small></td>
                      <td>{row.account_number} · {row.account_name}</td>
                      <td>{money(row.reporting_amount, row.reporting_currency)}</td>
                      <td>{row.latest_match_status || 'unmatched'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <div className="empty-state"><strong>No candidate journal lines returned</strong><span>No synthetic intercompany records were generated.</span></div>}
        </>
      ) : (
        <div className="empty-state">
          <strong>Intercompany evidence is not loaded</strong>
          <span>Provide a canonical consolidation group and load its organization-scoped posted journal evidence.</span>
        </div>
      )}
    </section>
  );
}
