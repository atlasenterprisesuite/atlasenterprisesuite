import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { resolveAdvisoryProviderReadiness } from '../../../../../packages/advisory/src';
import {
  listAdvisoryClients,
  listAdvisoryEngagements,
  listAdvisoryLaunchIntakes,
  listAdvisoryProviderAuthorizations,
  listAdvisoryProviderConnections
} from '../../lib/advisoryApi';
import './advisory.css';

function SurfaceIntro({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return <div className="feature-card wide">
    <p className="eyebrow">{eyebrow}</p>
    <h2>{title}</h2>
    <p>{description}</p>
  </div>;
}

export function AdvisoryTasksPage() {
  return <>
    <SurfaceIntro
      eyebrow="Canonical execution"
      title="Advisory work orchestration"
      description="Advisory reuses ATLAS Work OS and Guided Execution instead of creating a second task database."
    />
    <div className="module-grid">
      <Link className="module-card enabled" to="/work/new"><span>Create</span><strong>New work</strong><p>Start an auditable workflow for an Advisory engagement.</p></Link>
      <Link className="module-card enabled" to="/work/active"><span>Execute</span><strong>Active work</strong><p>Continue in-flight workflows and governed execution.</p></Link>
      <Link className="module-card enabled" to="/work/approvals"><span>Govern</span><strong>Approvals</strong><p>Review approval-bound actions before consequential execution.</p></Link>
      <Link className="module-card enabled" to="/work/history"><span>Audit</span><strong>History</strong><p>Review completed and historical work without duplicating the execution source of truth.</p></Link>
    </div>
  </>;
}

export function AdvisoryCrmPage() {
  return <>
    <SurfaceIntro
      eyebrow="Canonical CRM"
      title="Prospects, accounts and opportunities"
      description="CRM remains the relationship and opportunity source of truth. Advisory begins service delivery after a governed conversion into a client and engagement."
    />
    <div className="module-grid">
      <Link className="module-card enabled" to="/crm/contacts"><span>People</span><strong>Contacts</strong><p>Review customer and stakeholder relationship context.</p></Link>
      <Link className="module-card enabled" to="/crm/companies"><span>Accounts</span><strong>Companies</strong><p>Review company and account records.</p></Link>
      <Link className="module-card enabled" to="/crm/deals"><span>Pipeline</span><strong>Opportunities</strong><p>Work provider-backed opportunities before Advisory conversion.</p></Link>
      <Link className="module-card enabled" to="/crm/activities"><span>Activity</span><strong>CRM activities</strong><p>Keep calls, meetings, notes and email activity in the canonical CRM surface.</p></Link>
      <Link className="module-card enabled" to="/crm/integrations"><span>Connections</span><strong>CRM integrations</strong><p>Inspect provider connection readiness without fabricating a connected state.</p></Link>
    </div>
  </>;
}

export function AdvisoryReportsPage() {
  const [clients,setClients] = useState<Awaited<ReturnType<typeof listAdvisoryClients>>>([]);
  const [engagements,setEngagements] = useState<Awaited<ReturnType<typeof listAdvisoryEngagements>>>([]);
  const [intakes,setIntakes] = useState<Awaited<ReturnType<typeof listAdvisoryLaunchIntakes>>>([]);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [nextClients,nextEngagements,nextIntakes] = await Promise.all([
        listAdvisoryClients(),
        listAdvisoryEngagements(),
        listAdvisoryLaunchIntakes()
      ]);
      setClients(nextClients);
      setEngagements(nextEngagements);
      setIntakes(nextIntakes);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load Advisory reporting data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const metrics = useMemo(() => ({
    activeClients: clients.filter((client) => client.status === 'active').length,
    openEngagements: engagements.filter((engagement) => engagement.status !== 'closed').length,
    acceptedLaunches: intakes.filter((intake) => ['accepted','converted','invoiced'].includes(intake.status)).length,
    invoicedLaunches: intakes.filter((intake) => intake.status === 'invoiced').length
  }), [clients,engagements,intakes]);

  return <>
    <SurfaceIntro
      eyebrow="Persisted reporting"
      title="Advisory operational reports"
      description="These metrics are derived only from organization- and firm-scoped Advisory records. Revenue and cash are not inferred here; Accounting remains authoritative."
    />
    {loading ? <div className="notice">Loading authenticated Advisory reporting data…</div> : null}
    {error ? <div className="notice strong" role="alert">{error}</div> : null}
    {!loading && !error ? <>
      <div className="stat-grid">
        <article><strong>{metrics.activeClients}</strong><span>active clients</span></article>
        <article><strong>{metrics.openEngagements}</strong><span>open engagements</span></article>
        <article><strong>{metrics.acceptedLaunches}</strong><span>accepted Launch 360 requests</span></article>
        <article><strong>{metrics.invoicedLaunches}</strong><span>Launch 360 requests linked to issued invoices</span></article>
      </div>
      {clients.length === 0 && engagements.length === 0 && intakes.length === 0
        ? <div className="empty-state"><strong>No Advisory operating data yet</strong><span>Reports remain empty until real clients, engagements or public launch requests exist.</span></div>
        : null}
      <div className="module-grid">
        <Link className="module-card enabled" to="/analytics"><span>Cross-module</span><strong>ATLAS Analytics</strong><p>Analyze broader enterprise performance without creating a duplicate Advisory warehouse.</p></Link>
        <Link className="module-card enabled" to="/finance/accounting/accounts-receivable"><span>Accounting source</span><strong>Receivables</strong><p>Review invoices, balances and governed payment state in the accounting ledger.</p></Link>
        <Link className="module-card enabled" to="/advisory/business-launch-360/workspace"><span>Service evidence</span><strong>Launch readiness</strong><p>Review evidence-backed readiness at the engagement level.</p></Link>
      </div>
    </> : null}
  </>;
}

export function AdvisoryCompliancePage() {
  return <>
    <SurfaceIntro
      eyebrow="Evidence and approvals"
      title="Advisory compliance control center"
      description="Compliance state is evidence-driven. ATLAS does not infer professional licenses, signatures, consents or regulated authorization from a firm name or a UI action."
    />
    <div className="module-grid">
      <Link className="module-card enabled" to="/advisory/business-launch-360/workspace"><span>Evidence</span><strong>Readiness evidence</strong><p>Record only referenced, reviewable evidence for governed launch dimensions.</p></Link>
      <Link className="module-card enabled" to="/work/approvals"><span>Approval</span><strong>Consequential actions</strong><p>Route approval-bound actions through canonical Work approvals.</p></Link>
      <Link className="module-card enabled" to="/advisory/providers"><span>Authorization</span><strong>External providers</strong><p>Separate organization authorization from verified provider connectivity.</p></Link>
    </div>
    <div className="notice">Engagement letters, e-signature, conflict-check evidence and regulated registrations remain fail-closed until authenticated records or authorized providers exist.</div>
  </>;
}

export function AdvisoryAutomationsPage() {
  return <>
    <SurfaceIntro
      eyebrow="Governed automation"
      title="Advisory automation"
      description="Use ATLAS Work for repeatable low-risk execution. Billing, sensitive sharing, closure and regulated actions remain approval-bound."
    />
    <div className="module-grid">
      <Link className="module-card enabled" to="/work/new"><span>Build</span><strong>Create workflow</strong><p>Create a governed workflow from a real Advisory operating need.</p></Link>
      <Link className="module-card enabled" to="/work/active"><span>Operate</span><strong>Active automations</strong><p>Review execution state through the canonical Work surface.</p></Link>
      <Link className="module-card enabled" to="/work/policies"><span>Policy</span><strong>Execution policies</strong><p>Keep risk and approval policy outside browser-only Advisory state.</p></Link>
      <Link className="module-card enabled" to="/advisory/providers"><span>Boundary</span><strong>Provider readiness</strong><p>Do not run provider-backed automation unless authorization and connection verification are present.</p></Link>
    </div>
  </>;
}

export function AdvisorySettingsPage() {
  return <>
    <SurfaceIntro
      eyebrow="Firm configuration"
      title="Advisory settings"
      description="Firm configuration is organization-scoped. Identity, provider secrets and accessibility remain owned by their canonical platform surfaces."
    />
    <div className="module-grid">
      <Link className="module-card enabled" to="/identity?app=%2Fadvisory"><span>Access</span><strong>Identity & access</strong><p>Use ATLAS Identity for organization context and permission-bound access.</p></Link>
      <Link className="module-card enabled" to="/advisory/providers"><span>Integrations</span><strong>Provider readiness</strong><p>Inspect external capability authorization and verified connection state.</p></Link>
      <Link className="module-card enabled" to="/settings/accessibility/communication"><span>Experience</span><strong>Communication accessibility</strong><p>Reuse platform-wide communication and accessibility settings.</p></Link>
    </div>
    <div className="notice">Provider credentials and secrets are never stored in browser-visible Advisory records.</div>
  </>;
}

export function AdvisoryReadinessPage() {
  const [connections,setConnections] = useState<Awaited<ReturnType<typeof listAdvisoryProviderConnections>>>([]);
  const [authorizations,setAuthorizations] = useState<Awaited<ReturnType<typeof listAdvisoryProviderAuthorizations>>>([]);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState('');

  useEffect(() => {
    let active = true;
    void Promise.all([listAdvisoryProviderConnections(), listAdvisoryProviderAuthorizations()])
      .then(([nextConnections,nextAuthorizations]) => {
        if (!active) return;
        setConnections(nextConnections);
        setAuthorizations(nextAuthorizations);
        setError('');
      })
      .catch((cause) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Unable to evaluate provider readiness');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const providerReadiness = useMemo(
    () => resolveAdvisoryProviderReadiness(connections, authorizations),
    [connections,authorizations]
  );
  const connectedProviders = providerReadiness.filter((item) => item.status === 'connected').length;

  return <>
    <SurfaceIntro
      eyebrow="Release truth"
      title="Advisory production readiness"
      description="This surface separates implemented core capabilities from evidence still required before a production-ready claim."
    />
    {loading ? <div className="notice">Loading provider evidence…</div> : null}
    {error ? <div className="notice strong" role="alert">{error}</div> : null}
    <div className="readiness-grid">
      <article className="verified"><strong>Core persistence</strong><span>Implemented</span><small>Organization + firm scoped clients, engagements, launch evidence and audit events.</small></article>
      <article className="verified"><strong>Commercial flow</strong><span>Implemented</span><small>Public intake → quote → acceptance evidence → engagement → Accounts Receivable invoice.</small></article>
      <article className="verified"><strong>Canonical integrations</strong><span>Implemented</span><small>Work, CRM, Accounting and Analytics are reused rather than duplicated.</small></article>
      <article className={connectedProviders > 0 ? 'verified' : ''}><strong>External providers</strong><span>{connectedProviders} verified</span><small>Calendar, documents, e-sign, print, media, payment and publishing remain capability-gated.</small></article>
      <article><strong>Client portal</strong><span>Fail closed</span><small>Client/delegate identity scope must be implemented and verified before exposure.</small></article>
      <article><strong>Production E2E</strong><span>Evidence required</span><small>Deployment SHA, CI, route behavior, permissions and public endpoint verification remain independent release gates.</small></article>
    </div>
    <div className="module-grid">
      <Link className="module-card enabled" to="/advisory/providers"><span>Evidence</span><strong>Provider readiness</strong><p>Inspect provider authorization and connection verification.</p></Link>
      <Link className="module-card enabled" to="/work/approvals"><span>Governance</span><strong>Approvals</strong><p>Review consequential actions in the canonical execution layer.</p></Link>
      <Link className="module-card enabled" to="/advisory/reports"><span>Operations</span><strong>Advisory reports</strong><p>Review persisted operating metrics without synthetic revenue.</p></Link>
    </div>
  </>;
}
