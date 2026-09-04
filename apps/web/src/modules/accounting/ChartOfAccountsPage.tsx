import { useMemo, useState } from 'react';
import { useAccountingData } from './AccountingDataProvider';

export function ChartOfAccountsPage() {
  const state = useAccountingData();
  const [query, setQuery] = useState('');

  const accounts = useMemo(() => {
    if (state.status !== 'ready') return [];
    const normalized = query.trim().toLowerCase();
    const rows = normalized
      ? state.data.accounts.filter((account) =>
          [account.accountNumber, account.name, account.accountType]
            .some((value) => value.toLowerCase().includes(normalized)),
        )
      : state.data.accounts;

    return [...rows].sort((a, b) => a.accountNumber.localeCompare(b.accountNumber));
  }, [query, state]);

  return (
    <main className="atlas-page atlas-module-page">
      <p className="atlas-eyebrow">ATLAS Finance / Accounting</p>
      <h1>Chart of Accounts</h1>
      <p className="atlas-page__lede">
        Organization-scoped account definitions are read directly from the configured Accounting repository.
      </p>

      {(state.status === 'waiting' || state.status === 'loading') && (
        <section className="atlas-status-panel" role="status">
          <strong>Loading Chart of Accounts</strong>
          <span>Reading the authorized organization account definitions.</span>
        </section>
      )}

      {state.status === 'connection_unavailable' && (
        <section className="atlas-status-panel" role="status">
          <strong>Chart of Accounts connection unavailable</strong>
          <span>No configured real Accounting repository is available.</span>
        </section>
      )}

      {state.status === 'error' && (
        <section className="atlas-status-panel atlas-status-panel--degraded" role="status">
          <strong>Chart of Accounts unavailable</strong>
          <span>The authorized account query did not complete successfully.</span>
        </section>
      )}

      {state.status === 'ready' && (
        <>
          <label className="atlas-form-field">
            Search accounts
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Number, name, or type"
            />
          </label>

          {state.data.accounts.length === 0 ? (
            <section className="atlas-status-panel" aria-label="Chart of Accounts empty state">
              <strong>No accounts configured</strong>
              <span>This organization currently has no Chart of Accounts records.</span>
            </section>
          ) : accounts.length === 0 ? (
            <section className="atlas-status-panel" aria-label="Chart of Accounts no matches">
              <strong>No matching accounts</strong>
              <span>No real account records match the current search.</span>
            </section>
          ) : (
            <section className="atlas-status-panel" aria-label="Chart of Accounts records">
              <strong>{accounts.length} account{accounts.length === 1 ? '' : 's'}</strong>
              <div className="atlas-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Number</th>
                      <th>Name</th>
                      <th>Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accounts.map((account) => (
                      <tr key={account.id}>
                        <td>{account.accountNumber}</td>
                        <td>{account.name}</td>
                        <td>{account.accountType}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}
    </main>
  );
}
