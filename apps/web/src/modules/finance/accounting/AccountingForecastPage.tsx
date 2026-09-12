import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { ForecastSnapshotRecord } from '../../../../../../packages/accounting/src';
import { getAccountingForecastSnapshots } from '../../../lib/atlasSession';

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
  ['consolidation', 'Consolidation'],
  ['period-close', 'Period Close'],
  ['reports', 'Reports'],
  ['audit-trail', 'Audit Trail'],
  ['settings', 'Settings'],
] as const;

function payloadPreview(value: unknown) {
  if (value === null || value === undefined) return 'No payload';
  if (typeof value !== 'object') return String(value);
  const entries = Object.entries(value as Record<string, unknown>).slice(0, 6);
  if (entries.length === 0) return 'Empty payload';
  return entries.map(([key, item]) => `${key}: ${typeof item === 'object' ? JSON.stringify(item) : String(item)}`).join(' · ');
}

export function AccountingForecastPage() {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [rows, setRows] = useState<ForecastSnapshotRecord[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    getAccountingForecastSnapshots()
      .then((snapshots) => {
        if (!active) return;
        setRows(snapshots);
        setStatus('ready');
      })
      .catch((loadError: unknown) => {
        if (!active) return;
        setRows([]);
        setError(loadError instanceof Error ? loadError.message : 'Forecast data could not be loaded');
        setStatus('error');
      });
    return () => { active = false; };
  }, []);

  return (
    <section className="page-stack">
      <header className="page-header split-header">
        <div>
          <p className="eyebrow">ATLAS Finance · Accounting</p>
          <h1>Cash Flow Forecast</h1>
          <p>Organization-scoped forecast snapshots and scenario assumptions from the governed Accounting forecast store.</p>
        </div>
        <div className="asof-card"><span>Source</span><strong>Supabase RLS</strong></div>
      </header>

      <nav className="accounting-nav" aria-label="Accounting navigation">
        {accountingLinks.map(([slug, label]) => (
          <Link key={slug} className={slug === 'forecast' ? 'accounting-nav-link active' : 'accounting-nav-link'} to={`/finance/accounting/${slug}`}>{label}</Link>
        ))}
        <Link className="accounting-nav-link" to="/finance/accounting/accounts-payable">Payables + AI</Link>
      </nav>

      {status === 'loading' && <div className="notice">Loading authenticated forecast snapshots…</div>}
      {status === 'error' && (
        <div className="connection-gate">
          <strong>Forecast data unavailable</strong>
          <span>{error === 'authentication_required' ? 'Sign in through ATLAS Identity to load forecast data.' : error}</span>
          <Link className="text-link" to={`/identity?app=${encodeURIComponent('/finance/accounting/forecast')}`}>Open ATLAS Identity</Link>
        </div>
      )}

      {status === 'ready' && rows.length === 0 && (
        <div className="empty-state">
          <strong>No forecast snapshots</strong>
          <span>No forecast has been recorded for the authenticated organization. ATLAS will not fabricate forecast metrics.</span>
        </div>
      )}

      {status === 'ready' && rows.length > 0 && (
        <div className="workspace-card table-wrap">
          <table>
            <thead><tr><th>As of</th><th>Scenario</th><th>Horizon</th><th>Forecast</th><th>Assumptions</th><th>Created</th></tr></thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td><strong>{row.asOfDate}</strong></td>
                  <td><span className="status-pill">{row.scenario}</span></td>
                  <td>{row.horizonWeeks} weeks</td>
                  <td><small>{payloadPreview(row.forecast)}</small></td>
                  <td><small>{payloadPreview(row.assumptions)}</small></td>
                  <td>{row.createdAt || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
