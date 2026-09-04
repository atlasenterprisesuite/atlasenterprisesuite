import { useState } from 'react';
import { calculateAging, type BillApprovalState } from '../../../../../packages/accounting/src';
import { useAtlasContext } from '../../app/AtlasContext';
import { useAccountingData, useAccountingRefresh } from './AccountingDataProvider';
import { useArApWriteService } from './ArApWriteProvider';

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

function todayDateOnly() {
  return new Date().toISOString().slice(0, 10);
}

export function PayablesPage() {
  const identity = useAtlasContext();
  const state = useAccountingData();
  const refresh = useAccountingRefresh();
  const writeService = useArApWriteService();
  const [writeState, setWriteState] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [activeBillId, setActiveBillId] = useState<string | null>(null);
  const [writeError, setWriteError] = useState('');

  const canWrite = identity.status === 'ready'
    && identity.permissions.includes('accounting.write')
    && writeService !== null;

  const setApproval = async (billId: string, approvalState: BillApprovalState) => {
    if (identity.status !== 'ready' || !writeService) return;

    setActiveBillId(billId);
    setWriteState('saving');
    setWriteError('');
    try {
      await writeService.setBillApprovalState({
        organizationId: identity.organizationId,
        billId,
        approvalState,
      });
      setWriteState('success');
      setActiveBillId(null);
      refresh();
    } catch (error) {
      setWriteState('error');
      setActiveBillId(null);
      setWriteError(error instanceof Error ? error.message : 'Bill approval update failed');
    }
  };

  return (
    <main className="atlas-page atlas-module-page">
      <p className="atlas-eyebrow">ATLAS Finance / Accounting</p>
      <h1>Accounts Payable</h1>
      <p className="atlas-page__lede">
        Vendor bills are read from the authorized organization accounting records without fabricated payment activity.
      </p>

      {writeState === 'success' && (
        <section className="atlas-status-panel" role="status">
          <strong>Bill approval updated</strong>
          <span>Payables are being refreshed from the accounting repository.</span>
        </section>
      )}

      {writeState === 'error' && (
        <section className="atlas-status-panel atlas-status-panel--degraded" role="alert">
          <strong>Bill approval not updated</strong>
          <span>{writeError}</span>
        </section>
      )}

      {(state.status === 'waiting' || state.status === 'loading') && (
        <section className="atlas-status-panel" role="status">
          <strong>Loading payables</strong>
          <span>Reading authorized vendor and bill records.</span>
        </section>
      )}

      {state.status === 'connection_unavailable' && (
        <section className="atlas-status-panel" role="status">
          <strong>Accounts Payable connection unavailable</strong>
          <span>No configured real Accounting repository is available.</span>
        </section>
      )}

      {state.status === 'error' && (
        <section className="atlas-status-panel atlas-status-panel--degraded" role="status">
          <strong>Accounts Payable unavailable</strong>
          <span>The authorized payables query did not complete successfully.</span>
        </section>
      )}

      {state.status === 'ready' && (() => {
        const { bills, vendors } = state.data;
        const openBills = bills.filter((bill) => Number(bill.balanceDue) > 0);
        const aging = calculateAging(openBills, todayDateOnly());
        const vendorsById = new Map(vendors.map((vendor) => [vendor.id, vendor]));
        const vendorNames = Array.from(new Set(openBills
          .map((bill) => bill.vendorId ? vendorsById.get(bill.vendorId)?.name : undefined)
          .filter((name): name is string => Boolean(name))));

        return (
          <>
            <section className="atlas-card-grid" aria-label="Accounts Payable summary">
              <div className="atlas-module-card"><strong>{bills.length} bills</strong></div>
              <div className="atlas-module-card"><strong>{currency.format(aging.total)}</strong><span> open balance</span></div>
              <div className="atlas-module-card"><strong>{openBills.length} open</strong></div>
            </section>

            {bills.length === 0 ? (
              <section className="atlas-status-panel" aria-label="Accounts Payable empty state">
                <strong>No payables recorded</strong>
                <span>This organization currently has no vendor bill records.</span>
              </section>
            ) : (
              <>
                {vendorNames.length > 0 && (
                  <section className="atlas-status-panel" aria-label="Accounts Payable vendors">
                    <strong>Vendors</strong>
                    {vendorNames.map((name) => <span key={name}>{name}</span>)}
                  </section>
                )}

                <section className="atlas-status-panel" aria-label="Accounts Payable aging">
                  <strong>Payables aging</strong>
                  <span>Current: {currency.format(aging.current)}</span>
                  <span>1–30 days: {currency.format(aging.days1to30)}</span>
                  <span>31–60 days: {currency.format(aging.days31to60)}</span>
                  <span>61–90 days: {currency.format(aging.days61to90)}</span>
                  <span>Over 90 days: {currency.format(aging.over90)}</span>
                </section>

                <section className="atlas-status-panel" aria-label="Accounts Payable bills">
                  <strong>{bills.length} bill{bills.length === 1 ? '' : 's'}</strong>
                  <div className="atlas-table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Bill</th>
                          <th>Bill date</th>
                          <th>Due date</th>
                          <th>Amount</th>
                          <th>Balance</th>
                          <th>Approval</th>
                          <th>Match</th>
                          <th>Status</th>
                          {canWrite && <th>Action</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {bills.map((bill) => (
                          <tr key={bill.id}>
                            <td>{bill.billNumber}</td>
                            <td>{bill.billDate ?? 'Bill date not provided'}</td>
                            <td>{bill.dueDate ?? 'Due date not provided'}</td>
                            <td>{currency.format(bill.amount)}</td>
                            <td>{currency.format(bill.balanceDue)}</td>
                            <td>{bill.approvalState}</td>
                            <td>{bill.matchState}</td>
                            <td>{bill.status}</td>
                            {canWrite && (
                              <td>
                                <div className="atlas-action-row">
                                  {bill.approvalState !== 'approved' && (
                                    <button
                                      type="button"
                                      disabled={writeState === 'saving'}
                                      onClick={() => void setApproval(bill.id, 'approved')}
                                      aria-label={`Approve ${bill.billNumber}`}
                                    >
                                      {activeBillId === bill.id && writeState === 'saving' ? 'Saving' : 'Approve'}
                                    </button>
                                  )}
                                  {bill.approvalState !== 'rejected' && (
                                    <button
                                      type="button"
                                      disabled={writeState === 'saving'}
                                      onClick={() => void setApproval(bill.id, 'rejected')}
                                      aria-label={`Reject ${bill.billNumber}`}
                                    >
                                      Reject
                                    </button>
                                  )}
                                </div>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </>
            )}
          </>
        );
      })()}
    </main>
  );
}
