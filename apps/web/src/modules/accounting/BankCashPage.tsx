import { useBankCashData } from './BankCashData';

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

export function BankCashPage() {
  const { state } = useBankCashData();

  return (
    <main className="atlas-page atlas-module-page">
      <p className="atlas-eyebrow">ATLAS Finance / Accounting</p>
      <h1>Bank &amp; Cash</h1>
      <p className="atlas-page__lede">
        Bank accounts and transactions come only from authorized organization records. ATLAS does not claim an external bank connection unless one is actually configured.
      </p>

      {(state.status === 'waiting' || state.status === 'loading') && (
        <section className="atlas-status-panel" role="status"><strong>Loading Bank &amp; Cash</strong><span>Reading authorized bank and transaction records.</span></section>
      )}
      {state.status === 'connection_unavailable' && (
        <section className="atlas-status-panel" role="status"><strong>Bank &amp; Cash connection unavailable</strong><span>No configured real Accounting repository is available.</span></section>
      )}
      {state.status === 'error' && (
        <section className="atlas-status-panel atlas-status-panel--degraded" role="alert"><strong>Bank &amp; Cash unavailable</strong><span>The authorized bank data query did not complete successfully.</span></section>
      )}

      {state.status === 'ready' && (
        <>
          <section className="atlas-card-grid" aria-label="Bank and cash summary">
            <div className="atlas-module-card"><strong>{state.bankAccounts.length} bank account{state.bankAccounts.length === 1 ? '' : 's'}</strong></div>
            <div className="atlas-module-card"><strong>{state.transactions.length} transaction{state.transactions.length === 1 ? '' : 's'}</strong></div>
          </section>

          {state.bankAccounts.length === 0 && state.transactions.length === 0 ? (
            <section className="atlas-status-panel" aria-label="Bank and cash empty state">
              <strong>No bank or cash records</strong>
              <span>No authorized bank account or transaction records are available for this organization.</span>
            </section>
          ) : (
            <>
              {state.bankAccounts.length > 0 && (
                <section className="atlas-status-panel" aria-label="Bank accounts">
                  <strong>Bank accounts</strong>
                  <div className="atlas-table-wrap"><table><thead><tr><th>Account</th><th>Type</th><th>Currency</th><th>Mask</th><th>Connection</th><th>Balance</th><th>As of</th></tr></thead><tbody>
                    {state.bankAccounts.map((account) => <tr key={account.id}><td>{account.displayName}</td><td>{account.accountType ?? 'Not classified'}</td><td>{account.currency}</td><td>{account.mask ? `•••• ${account.mask}` : 'Not provided'}</td><td>{account.connectionState}</td><td>{account.currentBalance === null ? 'Unavailable' : currency.format(account.currentBalance)}</td><td>{account.balanceAsOf ?? 'Unavailable'}</td></tr>)}
                  </tbody></table></div>
                </section>
              )}
              {state.transactions.length > 0 && (
                <section className="atlas-status-panel" aria-label="Bank transactions">
                  <strong>Transactions</strong>
                  <div className="atlas-table-wrap"><table><thead><tr><th>Date</th><th>Description</th><th>Merchant</th><th>Amount</th><th>Status</th><th>Evidence</th></tr></thead><tbody>
                    {state.transactions.map((transaction) => <tr key={transaction.id}><td>{transaction.postedDate}</td><td>{transaction.description}</td><td>{transaction.merchant ?? 'Not provided'}</td><td>{currency.format(transaction.amount)}</td><td>{transaction.status}</td><td>{transaction.evidenceState}</td></tr>)}
                  </tbody></table></div>
                </section>
              )}
            </>
          )}
        </>
      )}
    </main>
  );
}
