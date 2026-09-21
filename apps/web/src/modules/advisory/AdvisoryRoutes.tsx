import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, Route, Routes } from 'react-router-dom';
import {
  AW_FINANCE_FIRM,
  BUSINESS_LAUNCH_360,
  LAUNCH_READINESS_DIMENSIONS,
  calculateLaunchReadiness,
  type LaunchEvidenceDimension,
  type ReadinessEvidence
} from '../../../../../packages/advisory/src';
import {
  bootstrapAdvisoryFirm,
  createAdvisoryClient,
  createAdvisoryEngagement,
  listAdvisoryClients,
  listAdvisoryEngagements,
  listAdvisoryLaunchEvidence,
  listAdvisoryLaunchIntakes,
  setAdvisoryLaunchQuote,
  acceptAdvisoryLaunchQuote,
  convertAdvisoryLaunchIntake,
  setAdvisoryLaunchBillingRefs,
  updateAdvisoryLaunchEvidence,
  type AdvisoryClientRow,
  type AdvisoryEngagementRow,
  type AdvisoryFirmRow,
  type AdvisoryLaunchEvidenceRow,
  type AdvisoryLaunchIntakeRow
} from '../../lib/advisoryApi';
import {
  addInvoiceLine,
  createDraftInvoice,
  createReceivablesCustomer,
  getLiveReceivablesLedger,
  issueInvoice,
  suggestInvoiceNumber
} from '../../lib/receivablesApi';
import './advisory.css';

const advisoryNav = [
  ['/advisory','Overview'],
  ['/advisory/clients','Clients'],
  ['/advisory/engagements','Engagements'],
  ['/advisory/business-launch-360/workspace','Business Launch 360'],
  ['/advisory/tasks','Tasks'],
  ['/advisory/calendar','Calendar'],
  ['/advisory/documents','Documents'],
  ['/advisory/billing','Billing'],
  ['/advisory/crm','CRM'],
  ['/advisory/portal','Portal'],
  ['/advisory/reports','Reports'],
  ['/advisory/compliance','Compliance'],
  ['/advisory/automations','Automations'],
  ['/advisory/settings','Settings']
] as const;

const dimensionLabels: Record<LaunchEvidenceDimension,string> = {
  business_setup:'Business setup', brand:'Brand', website:'Website', contact_channels:'Contact channels',
  crm:'CRM', payments:'Payments', accounting:'Accounting', marketing:'Marketing',
  compliance:'Compliance', analytics:'Analytics'
};

function AdvisoryLayout({ children }: { children: React.ReactNode }) {
  return <section className="advisory-shell">
    <header className="page-header">
      <p className="eyebrow">ATLAS Advisory Office</p>
      <h1>{AW_FINANCE_FIRM.name}</h1>
      <p>Firm #001 · Organization-scoped professional services operations.</p>
    </header>
    <nav className="advisory-nav" aria-label="Advisory Office">
      {advisoryNav.map(([to,label]) => <Link key={to} to={to}>{label}</Link>)}
    </nav>
    {children}
  </section>;
}

function Status({ loading, error }: { loading: boolean; error: string }) {
  if (loading) return <div className="notice">Loading authenticated Advisory records…</div>;
  if (error) return <div className="notice strong" role="alert">{error}</div>;
  return null;
}

function useWorkspace() {
  const [firm,setFirm] = useState<AdvisoryFirmRow | null>(null);
  const [clients,setClients] = useState<AdvisoryClientRow[]>([]);
  const [engagements,setEngagements] = useState<AdvisoryEngagementRow[]>([]);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const nextFirm = await bootstrapAdvisoryFirm();
      const [nextClients,nextEngagements] = await Promise.all([listAdvisoryClients(), listAdvisoryEngagements()]);
      setFirm(nextFirm); setClients(nextClients); setEngagements(nextEngagements);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load Advisory Office');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);
  return { firm,clients,engagements,loading,error,refresh };
}

export function AdvisoryOverviewPage() {
  const workspace = useWorkspace();
  const activeClients = workspace.clients.filter((client) => client.status === 'active').length;
  const openEngagements = workspace.engagements.filter((engagement) => engagement.status !== 'closed').length;
  const launchEngagements = workspace.engagements.filter((engagement) => engagement.service_id === BUSINESS_LAUNCH_360.id).length;
  return <AdvisoryLayout>
    <Status loading={workspace.loading} error={workspace.error} />
    <div className="stat-grid">
      <article><strong>{activeClients}</strong><span>active clients recorded</span></article>
      <article><strong>{openEngagements}</strong><span>open engagements recorded</span></article>
      <article><strong>{launchEngagements}</strong><span>Business Launch 360 engagements</span></article>
      <article><strong>{workspace.firm?.firm_number || '001'}</strong><span>firm number</span></article>
    </div>
    <div className="module-grid">
      <Link className="module-card enabled" to="/advisory/clients"><span>Firm operations</span><strong>Clients</strong><p>Create real organization-scoped client records through authenticated Supabase RPCs.</p></Link>
      <Link className="module-card enabled" to="/advisory/engagements"><span>Service delivery</span><strong>Engagements</strong><p>Open service engagements without duplicating CRM or Accounting as sources of truth.</p></Link>
      <Link className="module-card enabled" to="/advisory/business-launch-360/workspace"><span>Launch system</span><strong>Business Launch 360</strong><p>Evidence-based readiness across ten governed dimensions.</p></Link>
      <article className="module-card disabled" aria-disabled="true"><span>External providers</span><strong>Authorization required</strong><p>E-sign, print fulfillment, paid media, payment and publishing providers remain not connected until real provider authorization is verified.</p></article>
    </div>
  </AdvisoryLayout>;
}

function ClientsPage() {
  const workspace = useWorkspace();
  const [displayName,setDisplayName] = useState('');
  const [email,setEmail] = useState('');
  const [saving,setSaving] = useState(false);
  const [formError,setFormError] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true); setFormError('');
    try {
      await createAdvisoryClient({ displayName, email });
      setDisplayName(''); setEmail('');
      await workspace.refresh();
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : 'Client creation failed');
    } finally { setSaving(false); }
  }

  return <AdvisoryLayout>
    <Status loading={workspace.loading} error={workspace.error} />
    <div className="advisory-grid">
      <form className="feature-card advisory-form" onSubmit={submit}>
        <p className="eyebrow">New client</p><h2>Create client</h2>
        <label className="field"><span>Name</span><input required value={displayName} onChange={(event) => setDisplayName(event.target.value)} /></label>
        <label className="field"><span>Email</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
        {formError ? <p role="alert">{formError}</p> : null}
        <button type="submit" disabled={saving || !displayName.trim()}>{saving ? 'Saving…' : 'Create client'}</button>
      </form>
      <div className="feature-card">
        <p className="eyebrow">Firm records</p><h2>Clients</h2>
        {workspace.clients.length === 0 ? <div className="empty-state"><strong>No clients yet</strong><span>Create the first real client above. No demo clients are seeded.</span></div> :
          <div className="advisory-list">{workspace.clients.map((client) => <article key={client.id}><strong>{client.display_name}</strong><span>{client.client_type} · {client.status}</span><small>{client.email || 'No email recorded'}</small></article>)}</div>}
      </div>
    </div>
  </AdvisoryLayout>;
}

function EngagementsPage() {
  const workspace = useWorkspace();
  const [clientId,setClientId] = useState('');
  const [serviceId,setServiceId] = useState(BUSINESS_LAUNCH_360.id);
  const [title,setTitle] = useState(BUSINESS_LAUNCH_360.name);
  const [saving,setSaving] = useState(false);
  const [formError,setFormError] = useState('');

  useEffect(() => {
    if (!clientId && workspace.clients[0]) setClientId(workspace.clients[0].id);
  }, [clientId, workspace.clients]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true); setFormError('');
    try {
      await createAdvisoryEngagement({ clientId, serviceId, title });
      await workspace.refresh();
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : 'Engagement creation failed');
    } finally { setSaving(false); }
  }

  const clientById = useMemo(() => new Map(workspace.clients.map((client) => [client.id,client.display_name])), [workspace.clients]);

  return <AdvisoryLayout>
    <Status loading={workspace.loading} error={workspace.error} />
    <div className="advisory-grid">
      <form className="feature-card advisory-form" onSubmit={submit}>
        <p className="eyebrow">New engagement</p><h2>Open engagement</h2>
        <label className="field"><span>Client</span><select required value={clientId} onChange={(event) => setClientId(event.target.value)}><option value="">Select client</option>{workspace.clients.map((client) => <option key={client.id} value={client.id}>{client.display_name}</option>)}</select></label>
        <label className="field"><span>Service</span><select value={serviceId} onChange={(event) => { setServiceId(event.target.value); if (event.target.value === BUSINESS_LAUNCH_360.id) setTitle(BUSINESS_LAUNCH_360.name); }}><option value={BUSINESS_LAUNCH_360.id}>Business Launch 360</option><option value="bookkeeping">Bookkeeping</option><option value="payroll-advisory">Payroll Advisory</option><option value="tax-planning">Tax Planning</option><option value="business-consulting">Business Consulting</option></select></label>
        <label className="field"><span>Title</span><input required value={title} onChange={(event) => setTitle(event.target.value)} /></label>
        {formError ? <p role="alert">{formError}</p> : null}
        <button type="submit" disabled={saving || !clientId || !title.trim()}>{saving ? 'Saving…' : 'Open engagement'}</button>
      </form>
      <div className="feature-card">
        <p className="eyebrow">Service delivery</p><h2>Engagements</h2>
        {workspace.engagements.length === 0 ? <div className="empty-state"><strong>No engagements yet</strong><span>Open one only after a real client exists.</span></div> :
          <div className="advisory-list">{workspace.engagements.map((engagement) => <article key={engagement.id}><strong>{engagement.title}</strong><span>{clientById.get(engagement.client_id) || 'Client'} · {engagement.status}</span><small>{engagement.service_id}</small></article>)}</div>}
      </div>
    </div>
  </AdvisoryLayout>;
}


function isoDatePlus(days: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function LaunchCommercialPipeline({ onChanged }: { onChanged: () => Promise<void> }) {
  const [intakes,setIntakes] = useState<AdvisoryLaunchIntakeRow[]>([]);
  const [selectedId,setSelectedId] = useState('');
  const [quoteAmount,setQuoteAmount] = useState('');
  const [quoteTaxRate,setQuoteTaxRate] = useState('');
  const [paymentTermsDays,setPaymentTermsDays] = useState('');
  const [quoteNote,setQuoteNote] = useState('');
  const [acceptanceReference,setAcceptanceReference] = useState('');
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const [message,setMessage] = useState('');

  const refresh = useCallback(async () => {
    try {
      const rows = await listAdvisoryLaunchIntakes();
      setIntakes(rows);
      setSelectedId((current) => current && rows.some((item) => item.id === current) ? current : rows[0]?.id || '');
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load launch requests');
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const selected = useMemo(() => intakes.find((item) => item.id === selectedId) || null, [intakes,selectedId]);

  useEffect(() => {
    setQuoteAmount(selected?.quote_amount == null ? '' : String(selected.quote_amount));
    setQuoteTaxRate(selected?.quote_tax_rate == null ? '' : String(selected.quote_tax_rate));
    setPaymentTermsDays(selected?.quote_payment_terms_days == null ? '' : String(selected.quote_payment_terms_days));
    setQuoteNote(selected?.quote_note || '');
    setAcceptanceReference(selected?.quote_acceptance_reference || '');
  }, [selectedId, selected?.quote_amount, selected?.quote_tax_rate, selected?.quote_payment_terms_days, selected?.quote_note, selected?.quote_acceptance_reference]);

  async function run(action: () => Promise<void>) {
    setBusy(true); setError(''); setMessage('');
    try { await action(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Launch pipeline action failed'); }
    finally { setBusy(false); }
  }

  async function saveQuote() {
    if (!selected) return;
    const amount = Number(quoteAmount);
    const taxRate = Number(quoteTaxRate);
    const termsDays = Number(paymentTermsDays);
    if (!Number.isFinite(amount) || amount <= 0) { setError('Enter a positive quote amount.'); return; }
    if (!quoteTaxRate.trim() || !Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100) {
      setError('Record the applicable tax rate from 0 to 100 before saving the quote.');
      return;
    }
    if (!paymentTermsDays.trim() || !Number.isInteger(termsDays) || termsDays < 0 || termsDays > 365) {
      setError('Record invoice payment terms from 0 to 365 days before saving the quote.');
      return;
    }
    await run(async () => {
      await setAdvisoryLaunchQuote({ intakeId:selected.id, amount, taxRate, paymentTermsDays:termsDays, note:quoteNote });
      await refresh();
      setMessage('Quote saved. Any previous acceptance evidence was cleared because the commercial terms changed.');
    });
  }

  async function acceptQuote() {
    if (!selected) return;
    if (!acceptanceReference.trim()) { setError('Acceptance evidence reference is required.'); return; }
    await run(async () => {
      await acceptAdvisoryLaunchQuote({ intakeId:selected.id, acceptanceReference });
      await refresh();
      setMessage('Quote acceptance evidence recorded. The request is now eligible for conversion.');
    });
  }

  async function convert() {
    if (!selected) return;
    await run(async () => {
      await convertAdvisoryLaunchIntake(selected.id);
      await Promise.all([refresh(), onChanged()]);
      setMessage('Client and Business Launch 360 engagement created from the accepted quote.');
    });
  }

  async function createInvoice() {
    if (!selected) return;
    await run(async () => {
      let current = selected;
      const quotedAmount = current.quote_amount;
      const quotedTaxRate = current.quote_tax_rate;
      const paymentTerms = current.quote_payment_terms_days;
      if (quotedAmount == null || quotedAmount <= 0 || quotedTaxRate == null || paymentTerms == null) {
        throw new Error('Complete the quote amount, tax rate and payment terms before invoicing.');
      }
      if (!current.quote_accepted_at || !current.quote_acceptance_reference) {
        throw new Error('Quote acceptance evidence is required before invoicing.');
      }

      if (!current.advisory_client_id || !current.engagement_id) {
        current = await convertAdvisoryLaunchIntake(current.id);
      }

      let customerId = current.receivable_customer_id;
      if (!customerId) {
        const customer = await createReceivablesCustomer({
          name: current.business_name || current.full_name,
          email: current.email,
          phone: current.phone || undefined
        });
        customerId = customer.id;
        current = await setAdvisoryLaunchBillingRefs({
          intakeId: current.id,
          receivableCustomerId: customerId
        });
      }

      let invoiceId = current.invoice_id;
      if (!invoiceId) {
        const invoice = await createDraftInvoice({
          customerId,
          invoiceNumber: suggestInvoiceNumber(),
          issueDate: isoDatePlus(0),
          dueDate: isoDatePlus(paymentTerms)
        });
        invoiceId = invoice.id;
        current = await setAdvisoryLaunchBillingRefs({
          intakeId: current.id,
          receivableCustomerId: customerId,
          invoiceId
        });
      }

      const ledger = await getLiveReceivablesLedger();
      const invoice = ledger.invoices.find((item) => item.id === invoiceId);
      if (!invoice) throw new Error('Launch invoice could not be reloaded from Accounts Receivable.');

      if (invoice.status === 'draft') {
        const existingLine = ledger.lines.find((line) =>
          line.invoice_id === invoiceId && line.description === 'Business Launch 360 · Launch fee'
        );
        if (!existingLine) {
          await addInvoiceLine({
            invoiceId,
            description:'Business Launch 360 · Launch fee',
            quantity:1,
            unitPrice:quotedAmount,
            taxRate:quotedTaxRate
          });
        }
        await issueInvoice(invoiceId);
      } else if (invoice.status !== 'open') {
        throw new Error('Launch invoice is not in an issuable Accounts Receivable state.');
      }

      await setAdvisoryLaunchBillingRefs({
        intakeId: current.id,
        receivableCustomerId: customerId,
        invoiceId
      });
      await Promise.all([refresh(), onChanged()]);
      setMessage('Accounts Receivable invoice issued and linked to Business Launch 360.');
    });
  }

  const quoteReady = Boolean(selected?.quote_amount && selected.quote_tax_rate != null && selected.quote_payment_terms_days != null);
  const accepted = Boolean(selected?.quote_accepted_at && selected.quote_acceptance_reference);

  return <section className="feature-card wide">
    <div className="card-heading">
      <div><p className="eyebrow">Commercial pipeline</p><h2>Public intake → quote → acceptance → engagement → invoice</h2></div>
      <a className="text-link" href="https://www.atlasenterprisesuite.com/advisory/business-launch-360">Open public page</a>
    </div>
    {intakes.length === 0 ? <div className="empty-state"><strong>No public Launch 360 requests yet</strong><span>New website submissions will appear here without creating fabricated clients or revenue.</span></div> : <>
      <label className="field"><span>Launch request</span><select value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
        {intakes.map((item) => <option key={item.id} value={item.id}>{item.reference} · {item.business_name || item.full_name} · {item.status}</option>)}
      </select></label>
      {selected ? <div className="advisory-grid">
        <article className="module-card enabled">
          <span>{selected.reference}</span><strong>{selected.business_name || selected.full_name}</strong>
          <p>{selected.email}{selected.phone ? ' · ' + selected.phone : ''}</p>
          <small>{selected.business_stage || 'Stage not specified'} · {selected.status}</small>
        </article>
        <article className="module-card enabled">
          <span>Onboarding request</span><strong>{selected.goals ? 'Scope captured' : 'Scope pending'}</strong>
          <p>{selected.goals || 'No goals recorded.'}</p>
          <small>{selected.website || 'No website recorded'}</small>
        </article>
      </div> : null}
      <div className="advisory-grid">
        <label className="field"><span>Quote amount (USD)</span><input type="number" min="0.01" step="0.01" value={quoteAmount} onChange={(event) => setQuoteAmount(event.target.value)} /></label>
        <label className="field"><span>Tax rate (%)</span><input type="number" min="0" max="100" step="0.0001" value={quoteTaxRate} onChange={(event) => setQuoteTaxRate(event.target.value)} placeholder="Record 0 explicitly when applicable" /></label>
        <label className="field"><span>Payment terms (days)</span><input type="number" min="0" max="365" step="1" value={paymentTermsDays} onChange={(event) => setPaymentTermsDays(event.target.value)} placeholder="Record the approved terms" /></label>
        <label className="field"><span>Quote note</span><input value={quoteNote} onChange={(event) => setQuoteNote(event.target.value)} placeholder="Scope, exclusions or commercial note" /></label>
        <label className="field"><span>Acceptance evidence</span><input value={acceptanceReference} onChange={(event) => setAcceptanceReference(event.target.value)} placeholder="Signed quote, email, PO or approved record reference" /></label>
      </div>
      <div className="button-row">
        <button type="button" disabled={busy || !selected || selected.status === 'invoiced' || selected.status === 'closed'} onClick={() => void saveQuote()}>Save quote</button>
        <button type="button" disabled={busy || !selected || !quoteReady || !['quoted','accepted'].includes(selected.status)} onClick={() => void acceptQuote()}>Record acceptance</button>
        <button type="button" disabled={busy || !selected || !accepted || !['accepted','converted'].includes(selected.status)} onClick={() => void convert()}>Convert to client + engagement</button>
        <button type="button" disabled={busy || !selected || !accepted || selected.status === 'invoiced' || selected.status === 'closed'} onClick={() => void createInvoice()}>Create + issue AR invoice</button>
      </div>
      {message ? <div className="notice">{message}</div> : null}
      {error ? <div className="notice strong" role="alert">{error}</div> : null}
    </>}
  </section>;
}

function LaunchPage() {
  const workspace = useWorkspace();
  const launchEngagements = workspace.engagements.filter((engagement) => engagement.service_id === BUSINESS_LAUNCH_360.id);
  const [selectedId,setSelectedId] = useState('');
  const [evidence,setEvidence] = useState<AdvisoryLaunchEvidenceRow[]>([]);
  const [dimension,setDimension] = useState<LaunchEvidenceDimension>('business_setup');
  const [reference,setReference] = useState('');
  const [note,setNote] = useState('');
  const [saving,setSaving] = useState(false);
  const [error,setError] = useState('');

  useEffect(() => {
    if (!selectedId && launchEngagements[0]) setSelectedId(launchEngagements[0].id);
  }, [selectedId, launchEngagements]);

  const loadEvidence = useCallback(async () => {
    if (!selectedId) { setEvidence([]); return; }
    try { setEvidence(await listAdvisoryLaunchEvidence(selectedId)); setError(''); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to load launch evidence'); }
  }, [selectedId]);

  useEffect(() => { void loadEvidence(); }, [loadEvidence]);

  const readinessRecord = useMemo(() => {
    const base = Object.fromEntries(LAUNCH_READINESS_DIMENSIONS.map((item) => [item,false])) as ReadinessEvidence;
    for (const item of evidence) if (item.status === 'verified') base[item.dimension] = true;
    return base;
  }, [evidence]);
  const readiness = calculateLaunchReadiness(readinessRecord);

  async function verify(event: FormEvent) {
    event.preventDefault();
    if (!selectedId) return;
    setSaving(true); setError('');
    try {
      await updateAdvisoryLaunchEvidence({ engagementId:selectedId, dimension, status:'verified', evidenceReference:reference, note });
      setReference(''); setNote('');
      await loadEvidence();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Evidence update failed');
    } finally { setSaving(false); }
  }

  return <AdvisoryLayout>
    <Status loading={workspace.loading} error={workspace.error} />
    <LaunchCommercialPipeline onChanged={workspace.refresh} />
    <div className="stat-grid">
      <article><strong>{readiness.score}</strong><span>Launch Readiness / 100</span></article>
      <article><strong>{readiness.verified.length}</strong><span>verified dimensions</span></article>
      <article><strong>{readiness.missing.length}</strong><span>dimensions without verified evidence</span></article>
      <article><strong>{launchEngagements.length}</strong><span>Launch 360 engagements</span></article>
    </div>
    {launchEngagements.length === 0 ? <div className="empty-state"><strong>No Business Launch 360 engagement</strong><span>Create one from Engagements before recording readiness evidence.</span></div> :
      <>
        <label className="field"><span>Launch engagement</span><select value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>{launchEngagements.map((engagement) => <option key={engagement.id} value={engagement.id}>{engagement.title}</option>)}</select></label>
        <div className="readiness-grid">{LAUNCH_READINESS_DIMENSIONS.map((item) => {
          const row = evidence.find((entry) => entry.dimension === item);
          return <article key={item} className={row?.status === 'verified' ? 'verified' : ''}><strong>{dimensionLabels[item]}</strong><span>{row?.status || 'no evidence'}</span><small>{row?.evidence_reference || 'Evidence reference required for verification.'}</small></article>;
        })}</div>
        <form className="feature-card advisory-form" onSubmit={verify}>
          <p className="eyebrow">Evidence gate</p><h2>Verify readiness evidence</h2>
          <label className="field"><span>Dimension</span><select value={dimension} onChange={(event) => setDimension(event.target.value as LaunchEvidenceDimension)}>{LAUNCH_READINESS_DIMENSIONS.map((item) => <option key={item} value={item}>{dimensionLabels[item]}</option>)}</select></label>
          <label className="field"><span>Evidence reference</span><input required value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Document, URL, provider reference or verified internal record" /></label>
          <label className="field"><span>Note</span><textarea value={note} onChange={(event) => setNote(event.target.value)} /></label>
          {error ? <p role="alert">{error}</p> : null}
          <button type="submit" disabled={saving || !reference.trim()}>{saving ? 'Saving…' : 'Mark verified'}</button>
        </form>
      </>}
  </AdvisoryLayout>;
}

function BoundaryPage({ title, description }: { title: string; description: string }) {
  return <AdvisoryLayout><div className="feature-card wide"><p className="eyebrow">Governed boundary</p><h2>{title}</h2><p>{description}</p><div className="notice">No connected, approved, paid, signed, printed, shipped or fulfilled state is displayed without authenticated evidence.</div></div></AdvisoryLayout>;
}

export function AdvisoryRoutes() {
  return <Routes>
    <Route path="/advisory" element={<AdvisoryOverviewPage />} />
    <Route path="/advisory/firms/aw-finance-advisory-solutions" element={<Navigate to="/advisory" replace />} />
    <Route path="/advisory/clients" element={<ClientsPage />} />
    <Route path="/advisory/engagements" element={<EngagementsPage />} />
    <Route path="/advisory/business-launch-360" element={<LaunchPage />} />
    <Route path="/advisory/business-launch-360/workspace" element={<LaunchPage />} />
    <Route path="/advisory/tasks" element={<BoundaryPage title="Tasks" description="Task orchestration will reuse the canonical ATLAS execution/work layer rather than create a parallel task source of truth." />} />
    <Route path="/advisory/calendar" element={<BoundaryPage title="Calendar" description="Calendar events remain provider-gated until an authorized calendar connection is available for the active organization." />} />
    <Route path="/advisory/documents" element={<BoundaryPage title="Documents" description="Document metadata can be linked to engagements, but storage, signatures and provider delivery are not claimed as connected here." />} />
    <Route path="/advisory/billing" element={<Navigate to="/finance/accounting/accounts-receivable" replace />} />
    <Route path="/advisory/crm" element={<BoundaryPage title="CRM" description="Prospects and opportunities remain in canonical ATLAS CRM. Won opportunities may open Advisory clients and engagements through governed conversion." />} />
    <Route path="/advisory/portal" element={<BoundaryPage title="Client Portal" description="Client access is deny-by-default until authenticated client/delegate scope is implemented and verified." />} />
    <Route path="/advisory/reports" element={<BoundaryPage title="Reports" description="Reports will aggregate only persisted Advisory records and verified Accounting references. No synthetic business metrics are introduced." />} />
    <Route path="/advisory/compliance" element={<BoundaryPage title="Compliance" description="Conflict checks, engagement letters, consents and regulated authorizations require explicit evidence and approval gates." />} />
    <Route path="/advisory/automations" element={<BoundaryPage title="Automations" description="Low-risk reminders may be automated. Sensitive sharing, billing, closeout and regulated actions remain approval-bound." />} />
    <Route path="/advisory/settings" element={<BoundaryPage title="Settings" description="Firm configuration remains organization-scoped. Provider credentials and secrets are never stored in browser-visible Advisory records." />} />
    <Route path="/advisory/*" element={<Navigate to="/advisory" replace />} />
  </Routes>;
}
