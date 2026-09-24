
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  createTaxReturn,
  listTaxReturns,
  type TaxReturnRow
} from '../../lib/taxApi';
import {
  bootstrapAdvisoryFirm,
  listAdvisoryClients,
  type AdvisoryClientRow
} from '../../lib/advisoryApi';

const labels: Record<TaxReturnRow['return_kind'], string> = {
  '1040': '1040 · Individual',
  '1065': '1065 · Partnership',
  '1120-S': '1120-S · S Corporation',
  '1120': '1120 · C Corporation',
  '1041': '1041 · Estate / Trust'
};

const ACTIVE_STATUSES: TaxReturnRow['status'][] = [
  'organizer','waiting_on_client','preparation','review','signature','ready_to_file','rejected','extension','amended'
];

export function TaxControlCenter() {
  const navigate = useNavigate();
  const [returns, setReturns] = useState<TaxReturnRow[]>([]);
  const [clients, setClients] = useState<AdvisoryClientRow[]>([]);
  const [clientId, setClientId] = useState('');
  const [returnKind, setReturnKind] = useState<TaxReturnRow['return_kind']>('1040');
  const [taxYear, setTaxYear] = useState(2026);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      await bootstrapAdvisoryFirm();
      const [nextReturns, nextClients] = await Promise.all([listTaxReturns(), listAdvisoryClients()]);
      setReturns(nextReturns);
      setClients(nextClients);
      setClientId((current) => current || nextClients[0]?.id || '');
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'tax_control_center_unavailable');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const counts = useMemo(() => ({
    active: returns.filter((item) => ACTIVE_STATUSES.includes(item.status)).length,
    review: returns.filter((item) => item.status === 'review').length,
    signature: returns.filter((item) => item.status === 'signature').length,
    ready: returns.filter((item) => item.status === 'ready_to_file').length,
    accepted: returns.filter((item) => item.status === 'accepted').length,
    rejected: returns.filter((item) => item.status === 'rejected').length
  }), [returns]);

  const clientName = (id: string) => clients.find((item) => item.id === id)?.display_name || 'Client';

  const createReturn = async () => {
    if (!clientId) return;
    setWorking(true);
    setError('');
    try {
      const created = await createTaxReturn({ clientId, taxYear, returnKind });
      navigate('/tax/prepare?returnId=' + encodeURIComponent(created.id));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'tax_return_create_failed');
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="page-stack">
      <section className="tax-panel">
        <div className="tax-panel-heading">
          <div>
            <p className="eyebrow">ATLAS Tax Professional</p>
            <h2>Tax Control Center</h2>
            <p>Live return work queue backed by the ATLAS Tax persistence layer.</p>
          </div>
          <button type="button" onClick={() => void refresh()} disabled={loading}>Refresh</button>
        </div>

        {error ? <div className="notice"><strong>Tax data unavailable.</strong> {error}</div> : null}

        <div className="tax-pro-diagnostics">
          <article><small>Active</small><strong>{counts.active}</strong><p>Organizer through preparation/review.</p></article>
          <article><small>Review</small><strong>{counts.review}</strong><p>Professional review queue.</p></article>
          <article><small>Signature</small><strong>{counts.signature}</strong><p>Waiting client authorization.</p></article>
          <article><small>Ready to file</small><strong>{counts.ready}</strong><p>Prepared package; transmission remains provider-gated.</p></article>
          <article><small>Accepted</small><strong>{counts.accepted}</strong><p>Accepted returns.</p></article>
          <article><small>Rejected</small><strong>{counts.rejected}</strong><p>Reject resolution queue.</p></article>
        </div>
      </section>

      <section className="tax-panel">
        <p className="eyebrow">New return</p>
        <h2>Create persistent return</h2>
        <div className="tax-field-grid">
          <label className="field">
            <span>Client</span>
            <select value={clientId} onChange={(event) => setClientId(event.target.value)}>
              <option value="">Select client</option>
              {clients.map((client) => <option value={client.id} key={client.id}>{client.display_name}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Return type</span>
            <select value={returnKind} onChange={(event) => setReturnKind(event.target.value as TaxReturnRow['return_kind'])}>
              {Object.entries(labels).map(([value,label]) => <option value={value} key={value}>{label}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Tax year</span>
            <select value={taxYear} onChange={(event) => setTaxYear(Number(event.target.value))}>
              <option value={2025}>2025</option>
              <option value={2026}>2026</option>
            </select>
          </label>
        </div>
        <div>
          <button type="button" className="primary-action" disabled={working || !clientId} onClick={() => void createReturn()}>
            {working ? 'Creating…' : 'Create return'}
          </button>
        </div>
      </section>

      <section className="tax-panel">
        <div className="tax-panel-heading">
          <div><p className="eyebrow">Work queue</p><h2>Returns</h2></div>
          <span className="tax-status ok">{returns.length} persisted</span>
        </div>
        {loading ? <div className="empty-state"><strong>Loading tax returns</strong><span>Reading organization-scoped records.</span></div> : null}
        {!loading && !returns.length ? <div className="empty-state"><strong>No tax returns yet</strong><span>Create the first persistent return above.</span></div> : null}
        <div className="tax-return-table">
          {returns.map((item) => (
            <Link className="tax-return-row" to={'/tax/prepare?returnId=' + encodeURIComponent(item.id)} key={item.id}>
              <div><small>Client</small><strong>{clientName(item.client_id)}</strong></div>
              <div><small>Return</small><strong>{labels[item.return_kind]}</strong></div>
              <div><small>Year</small><strong>{item.tax_year}</strong></div>
              <div><small>Status</small><strong>{item.status.replaceAll('_',' ')}</strong></div>
              <div><small>Step</small><strong>{item.current_step_id}</strong></div>
              <div><small>Revision</small><strong>v{item.revision}</strong></div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
