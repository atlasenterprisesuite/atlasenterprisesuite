import { useState } from 'react';
import type { ReconciliationItemStatus, ReconciliationMatchType } from '../../../../../packages/accounting/src';
import { useAtlasContext } from '../../app/AtlasContext';
import { useBankCashData } from './BankCashData';
import { useBankCashWriteService } from './BankCashWriteProvider';

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

export function ReconciliationPage() {
  const identity = useAtlasContext();
  const { state, refresh } = useBankCashData();
  const writeService = useBankCashWriteService();
  const [showForm, setShowForm] = useState(false);
  const [bankAccountId, setBankAccountId] = useState('');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [statementBalance, setStatementBalance] = useState('');
  const [ledgerBalance, setLedgerBalance] = useState('');
  const [writeState, setWriteState] = useState<'idle' | 'saving' | 'started' | 'closed' | 'updated' | 'error'>('idle');
  const [writeError, setWriteError] = useState('');

  const canWrite = identity.status === 'ready'
    && identity.permissions.includes('accounting.write')
    && writeService !== null;

  const start = async () => {
    if (identity.status !== 'ready' || !writeService || state.status !== 'ready') return;
    const selectedBankAccountId = bankAccountId || state.bankAccounts[0]?.id;
    if (!selectedBankAccountId) return;
    setWriteState('saving');
    setWriteError('');
    try {
      await writeService.startReconciliation({
        organizationId: identity.organizationId,
        bankAccountId: selectedBankAccountId,
        periodStart,
        periodEnd,
        statementEndingBalance: Number(statementBalance),
        ledgerEndingBalance: Number(ledgerBalance),
      });
      setWriteState('started');
      setShowForm(false);
      refresh();
    } catch (error) {
      setWriteState('error');
      setWriteError(error instanceof Error ? error.message : 'Reconciliation could not be started');
    }
  };

  const resolveItem = async (
    itemId: string,
    status: ReconciliationItemStatus,
    matchType: ReconciliationMatchType,
  ) => {
    if (identity.status !== 'ready' || !writeService) return;
    setWriteState('saving');
    setWriteError('');
    try {
      await writeService.resolveReconciliationItem({
        organizationId: identity.organizationId,
        itemId,
        status,
        matchType,
        variance: 0,
        note: status === 'excluded' ? 'Excluded during reconciliation' : null,
      });
      setWriteState('updated');
      refresh();
    } catch (error) {
      setWriteState('error');
      setWriteError(error instanceof Error ? error.message : 'Reconciliation item could not be updated');
    }
  };

  const close = async (sessionId: string) => {
    if (identity.status !== 'ready' || !writeService) return;
    setWriteState('saving');
    setWriteError('');
    try {
      await writeService.closeReconciliation({ organizationId: identity.organizationId, sessionId });
      setWriteState('closed');
      refresh();
    } catch (error) {
      setWriteState('error');
      setWriteError(error instanceof Error ? error.message : 'Reconciliation could not be closed');
    }
  };

  return (
    <main className="atlas-page atlas-module-page">
      <p className="atlas-eyebrow">ATLAS Finance / Accounting</p>
      <h1>Reconciliation</h1>
      <p className="atlas-page__lede">
        Statement and ledger balances must agree and every reconciliation item must be resolved or excluded before PostgreSQL permits closing.
      </p>

      {writeState === 'started' && <section className="atlas-status-panel" role="status"><strong>Reconciliation started</strong><span>Reloaded from the accounting repository.</span></section>}
      {writeState === 'closed' && <section className="atlas-status-panel" role="status"><strong>Reconciliation closed</strong><span>The session status is being refreshed from the accounting repository.</span></section>}
      {writeState === 'updated' && <section className="atlas-status-panel" role="status"><strong>Reconciliation item updated</strong><span>Readiness is being refreshed from the accounting repository.</span></section>}
      {writeState === 'error' && <section className="atlas-status-panel atlas-status-panel--degraded" role="alert"><strong>Reconciliation write rejected</strong><span>{writeError}</span></section>}

      {(state.status === 'waiting' || state.status === 'loading') && <section className="atlas-status-panel" role="status"><strong>Loading reconciliation</strong><span>Reading authorized Bank &amp; Cash records.</span></section>}
      {state.status === 'connection_unavailable' && <section className="atlas-status-panel" role="status"><strong>Reconciliation connection unavailable</strong><span>No configured real Accounting repository is available.</span></section>}
      {state.status === 'error' && <section className="atlas-status-panel atlas-status-panel--degraded" role="alert"><strong>Reconciliation unavailable</strong><span>The authorized reconciliation query did not complete successfully.</span></section>}

      {state.status === 'ready' && (
        <>
          <section className="atlas-status-panel" aria-label="Reconciliation bank accounts">
            <strong>Bank accounts</strong>
            {state.bankAccounts.length === 0
              ? <span>No authorized bank accounts are available. A reconciliation cannot be started.</span>
              : state.bankAccounts.map((account) => <span key={account.id}>{account.displayName} · {account.connectionState}</span>)}
          </section>

          {canWrite && state.bankAccounts.length > 0 && !showForm && (
            <button type="button" onClick={() => setShowForm(true)}>Start reconciliation</button>
          )}

          {canWrite && showForm && (
            <section className="atlas-status-panel" aria-label="Start reconciliation form">
              <strong>Start reconciliation</strong>
              <label>Bank account
                <select value={bankAccountId || state.bankAccounts[0]?.id || ''} onChange={(event) => setBankAccountId(event.target.value)}>
                  {state.bankAccounts.map((account) => <option key={account.id} value={account.id}>{account.displayName}</option>)}
                </select>
              </label>
              <label>Period start<input aria-label="Period start" type="date" value={periodStart} onChange={(event) => setPeriodStart(event.target.value)} /></label>
              <label>Period end<input aria-label="Period end" type="date" value={periodEnd} onChange={(event) => setPeriodEnd(event.target.value)} /></label>
              <label>Statement ending balance<input aria-label="Statement ending balance" type="number" step="0.01" value={statementBalance} onChange={(event) => setStatementBalance(event.target.value)} /></label>
              <label>Ledger ending balance<input aria-label="Ledger ending balance" type="number" step="0.01" value={ledgerBalance} onChange={(event) => setLedgerBalance(event.target.value)} /></label>
              <div className="atlas-action-row">
                <button type="button" disabled={writeState === 'saving'} onClick={() => void start()}>Submit reconciliation</button>
                <button type="button" onClick={() => setShowForm(false)}>Cancel</button>
              </div>
            </section>
          )}

          {state.sessions.length === 0 ? (
            <section className="atlas-status-panel" aria-label="Reconciliation empty state"><strong>No reconciliations recorded</strong><span>No reconciliation sessions exist for this organization.</span></section>
          ) : (
            <section className="atlas-status-panel" aria-label="Reconciliation sessions">
              <strong>Sessions</strong>
              <div className="atlas-table-wrap"><table><thead><tr><th>Period</th><th>Statement</th><th>Ledger</th><th>Difference</th><th>Status</th><th>Readiness</th>{canWrite && <th>Action</th>}</tr></thead><tbody>
                {state.sessions.map((session) => {
                  const statement = session.statementEndingBalance ?? 0;
                  const ledger = session.ledgerEndingBalance ?? 0;
                  return <tr key={session.id}><td>{session.periodStart} to {session.periodEnd}</td><td>{currency.format(statement)}</td><td>{currency.format(ledger)}</td><td>{currency.format(statement - ledger)}</td><td>{session.status}</td><td>{session.readinessScore}%</td>{canWrite && <td>{!['reconciled', 'locked'].includes(session.status) && <button type="button" disabled={writeState === 'saving'} aria-label={`Close reconciliation ${session.id}`} onClick={() => void close(session.id)}>Close</button>}</td>}</tr>;
                })}
              </tbody></table></div>
            </section>
          )}

          {state.items.length > 0 && (
            <section className="atlas-status-panel" aria-label="Reconciliation items">
              <strong>Items</strong>
              <div className="atlas-table-wrap"><table><thead><tr><th>Item</th><th>Match</th><th>Status</th><th>Variance</th>{canWrite && <th>Action</th>}</tr></thead><tbody>
                {state.items.map((item) => <tr key={item.id}><td>{item.transactionId ?? item.id}</td><td>{item.matchType ?? 'Unclassified'}</td><td>{item.status}</td><td>{currency.format(item.variance)}</td>{canWrite && <td>{item.status === 'open' && <div className="atlas-action-row"><button type="button" onClick={() => void resolveItem(item.id, 'resolved', 'matched')}>Resolve matched</button><button type="button" onClick={() => void resolveItem(item.id, 'excluded', 'manual')}>Exclude</button></div>}</td>}</tr>)}
              </tbody></table></div>
            </section>
          )}
        </>
      )}
    </main>
  );
}
