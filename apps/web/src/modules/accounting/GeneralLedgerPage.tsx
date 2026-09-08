import { buildGeneralLedger } from '../../../../../packages/accounting/src';
import { useAccountingData } from './AccountingDataProvider';

function amount(value: number): string {
  return value.toFixed(2);
}

export function GeneralLedgerPage() {
  const state = useAccountingData();

  const rows = state.status === 'ready'
    ? buildGeneralLedger(state.data.accounts, state.data.journals)
    : [];

  return (
    <main className="atlas-page atlas-module-page">
      <p className="atlas-eyebrow">ATLAS Finance / Accounting</p>
      <h1>General Ledger</h1>
      <p className="atlas-page__lede">
        Ledger activity is derived only from posted journal lines for the authorized organization.
      </p>

      {(state.status === 'waiting' || state.status === 'loading') && (
        <section className="atlas-status-panel" role="status">
          <strong>Loading General Ledger</strong>
          <span>Reading posted journal activity and account metadata.</span>
        </section>
      )}

      {state.status === 'connection_unavailable' && (
        <section className="atlas-status-panel" role="status">
          <strong>General Ledger connection unavailable</strong>
          <span>No configured real Accounting repository is available.</span>
        </section>
      )}

      {state.status === 'error' && (
        <section className="atlas-status-panel atlas-status-panel--degraded" role="status">
          <strong>General Ledger unavailable</strong>
          <span>The authorized ledger query did not complete successfully.</span>
        </section>
      )}

      {state.status === 'ready' && rows.length === 0 && (
        <section className="atlas-status-panel" aria-label="General Ledger empty state">
          <strong>No posted ledger activity</strong>
          <span>This organization currently has no posted journal lines to display.</span>
        </section>
      )}

      {state.status === 'ready' && rows.length > 0 && (
        <section className="atlas-status-panel" aria-label="General Ledger rows">
          <strong>Posted ledger activity</strong>
          <div className="atlas-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Entry</th>
                  <th>Account</th>
                  <th>Memo</th>
                  <th>Debit</th>
                  <th>Credit</th>
                  <th>Running net</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.journalLineId}>
                    <td>{row.entryDate ?? 'Not dated'}</td>
                    <td>{row.entryNumber}</td>
                    <td>
                      {row.accountNumber && row.accountName
                        ? `${row.accountNumber} · ${row.accountName}`
                        : 'Unresolved account'}
                    </td>
                    <td>{row.memo ?? ''}</td>
                    <td>{amount(row.debit)}</td>
                    <td>{amount(row.credit)}</td>
                    <td>{amount(row.runningNet)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  );
}
