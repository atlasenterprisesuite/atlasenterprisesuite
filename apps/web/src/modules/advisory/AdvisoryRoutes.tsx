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
  updateAdvisoryLaunchEvidence,
  type AdvisoryClientRow,
  type AdvisoryEngagementRow,
  type AdvisoryFirmRow,
  type AdvisoryLaunchEvidenceRow
} from '../../lib/advisoryApi';
import './advisory.css';

const advisoryNav = [
  ['/advisory','Overview'],
  ['/advisory/clients','Clients'],
  ['/advisory/engagements','Engagements'],
  ['/advisory/business-launch-360','Business Launch 360'],
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
      <Link className="module-card enabled" to="/advisory/business-launch-360"><span>Launch system</span><strong>Business Launch 360</strong><p>Evidence-based readiness across ten governed dimensions.</p></Link>
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
