import { FormEvent, useEffect, useMemo, useState } from 'react';
import { ArApWriteService } from '../../../../../../packages/accounting/src';
import { AtlasRestArApWriteGateway } from '../../../lib/accountingWriteGateway';
import { getLivePayablesLedger, type LivePayableBill } from '../../../lib/atlasSession';

export function PayablesApprovalPanel({ onChanged }: { onChanged: () => void }) {
  const service = useMemo(() => new ArApWriteService(new AtlasRestArApWriteGateway()), []);
  const [organizationId, setOrganizationId] = useState('');
  const [bills, setBills] = useState<LivePayableBill[]>([]);
  const [billId, setBillId] = useState('');
  const [state, setState] = useState<'approved' | 'rejected'>('approved');
  const [feedback, setFeedback] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    void getLivePayablesLedger().then((ledger) => {
      if (!active) return;
      setOrganizationId(ledger.organization.id);
      setBills(ledger.bills.filter((bill) => bill.approval_state === 'pending'));
    }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  if (!organizationId) return null;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setFeedback('');
    void service.setBillApprovalState({ organizationId, billId, approvalState: state })
      .then(() => {
        setFeedback(`Success: bill ${state}.`);
        setBills((rows) => rows.filter((row) => row.id !== billId));
        setBillId('');
        onChanged();
      })
      .catch((error: unknown) => setFeedback(`Error: ${error instanceof Error ? error.message : 'AP approval failed'}`))
      .finally(() => setBusy(false));
  };

  return (
    <article className="workspace-card accounting-action-card">
      <div className="accounting-action-heading"><div><p className="eyebrow">Governed AP action</p><h2>Bill approval</h2><p>Approve or reject a pending vendor bill through the server-side accounting permission boundary.</p></div><span className="badge">SERVER PERMISSION ENFORCED</span></div>
      <form className="accounting-action-form" onSubmit={submit}>
        <label className="field"><span>Pending bill</span><select value={billId} onChange={(event) => setBillId(event.target.value)} required><option value="">Select bill</option>{bills.map((bill) => <option key={bill.id} value={bill.id}>{bill.bill_number} · {bill.vendor?.name || 'Unassigned'} · {Number(bill.balance_due).toFixed(2)}</option>)}</select></label>
        <label className="field"><span>Decision</span><select value={state} onChange={(event) => setState(event.target.value as 'approved' | 'rejected')}><option value="approved">Approve</option><option value="rejected">Reject</option></select></label>
        <button className="action-button" disabled={busy || !billId}>{busy ? 'Saving…' : 'Apply decision'}</button>
      </form>
      {bills.length === 0 && <div className="empty-state"><strong>No pending bills</strong><span>There are no authenticated pending bill approvals in this organization.</span></div>}
      {feedback && <div className={feedback.startsWith('Success:') ? 'notice' : 'notice strong'}>{feedback}</div>}
    </article>
  );
}
