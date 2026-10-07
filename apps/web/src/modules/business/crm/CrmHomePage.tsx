import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { CrmConnectionView } from '../../../../../../packages/core/src/crm';
import { canDisplayEvidenceBackedState } from '../../../../../../packages/core/src/evidence';
import { ModuleExperiencePage, type ModuleExperienceSection } from '../../../components/ModuleExperiencePage';
import { crmApi } from './crmApi';

const workspaces = [
  { to: '/crm/contacts', title: 'Contacts', description: 'Customer people and relationship context.' },
  { to: '/crm/companies', title: 'Accounts', description: 'Company and account relationship context.' },
  { to: '/crm/deals', title: 'Opportunities', description: 'Deal pipeline records from the connected provider.' },
  { to: '/crm/service', title: 'Service Cases', description: 'Ticket and service history where scope permits.' },
  { to: '/crm/activities', title: 'Activities', description: 'Tasks, calls, meetings, notes and email activity.' },
  { to: '/crm/integrations', title: 'Integrations', description: 'Connection readiness and provider controls.' }
] as const;

const crmSections: ModuleExperienceSection[] = [
  {
    eyebrow: 'Customer architecture',
    title: 'Provider-backed customer operations',
    description: 'CRM workspaces stay inside the authenticated ATLAS organization and read only from authorized provider-backed operations.',
    cards: workspaces.map((workspace) => ({
      label: 'CRM',
      title: workspace.title,
      description: workspace.description,
      to: workspace.to
    }))
  },
  {
    eyebrow: 'Governance',
    title: 'Connection truth before metrics',
    description: 'ATLAS separates presentation from provider readiness so customer data and connection state remain source-backed.',
    cards: [
      { label: 'Identity', title: 'Organization scoped', description: 'CRM requests remain bound to the authenticated ATLAS organization context.' },
      { label: 'Provider', title: 'Verified provider state', description: 'Connection readiness continues to come from the existing CRM connection-status operation.' },
      { label: 'Evidence', title: 'No fabricated pipeline totals', description: 'Pipeline totals, revenue, counts and activity metrics stay hidden unless an authorized live provider response supplies them.' }
    ]
  }
];

const stateLabel: Record<CrmConnectionView['state'], string> = {
  unconfigured: 'Not configured',
  authorizing: 'Authorizing',
  connected: 'Connected',
  degraded: 'Degraded',
  expired: 'Expired',
  revoked: 'Revoked',
  error: 'Error'
};

export function CrmHomePage() {
  const [hubSpot, setHubSpot] = useState<CrmConnectionView | null>(null);
  const [salesforce, setSalesforce] = useState<{
    connection: CrmConnectionView;
    candidateCount: number;
    canonicalRequired: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.allSettled([
      crmApi<{ connection: CrmConnectionView }>('connection.status'),
      crmApi<{
        connection: CrmConnectionView;
        candidateCount: number;
        canonicalRequired: boolean;
      }>('connection.status', {}, 'salesforce')
    ])
      .then(([hubSpotResult, salesforceResult]) => {
        if (!active) return;
        if (hubSpotResult.status === 'fulfilled') setHubSpot(hubSpotResult.value.connection);
        if (salesforceResult.status === 'fulfilled') setSalesforce(salesforceResult.value);
        const failures = [hubSpotResult, salesforceResult].filter(
          (result) => result.status === 'rejected'
        );
        setError(
          failures.length === 2
            ? 'CRM provider connection status is unavailable.'
            : null
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const evidenceBacked = (provider: 'hubspot' | 'salesforce', connection: CrmConnectionView | null) => {
    const evidence =
      connection?.state === 'connected' &&
      connection.providerAccountId &&
      connection.lastVerifiedAt
        ? {
            authenticated: true,
            authoritative: true,
            source: `${provider}:connection.status`,
            reference: connection.providerAccountId,
            observedAt: connection.lastVerifiedAt
          }
        : null;

    return connection?.state === 'connected' &&
      canDisplayEvidenceBackedState({ state: 'connected', evidence });
  };

  const hubSpotVerified = evidenceBacked('hubspot', hubSpot);
  const salesforceVerified =
    !salesforce?.canonicalRequired &&
    evidenceBacked('salesforce', salesforce?.connection ?? null);
  const anyVerified = hubSpotVerified || salesforceVerified;

  return (
    <ModuleExperiencePage
      eyebrow="ATLAS CRM"
      title="ATLAS CRM"
      description="Governed customer operations using the authenticated ATLAS organization and provider-backed data only."
      narrative="Customer intelligence, relationship context and governed provider data."
      sections={crmSections}
      statusNote="No pipeline totals, revenue, customer counts or activity metrics are shown unless they come from an authorized live provider response."
    >
      <div className="crm-connection-summary" aria-live="polite">
        {loading ? <span className="crm-status neutral">Checking connections</span> : null}
        {!loading && hubSpot ? (
          <span className={`crm-status ${hubSpot.state}`}>
            HubSpot · {stateLabel[hubSpot.state]}
          </span>
        ) : null}
        {!loading && salesforce ? (
          <span className={`crm-status ${salesforce.canonicalRequired ? 'degraded' : salesforce.connection.state}`}>
            Salesforce · {salesforce.canonicalRequired ? 'Canonical org required' : stateLabel[salesforce.connection.state]}
          </span>
        ) : null}
      </div>

      {error ? <div className="crm-banner error" role="alert">{error}</div> : null}

      {salesforce?.canonicalRequired ? (
        <div className="crm-banner degraded" role="status">
          <strong>Salesforce canonical org required</strong>
          <span>
            ATLAS detected {salesforce.candidateCount} verified Salesforce organizations.
            Inventory and classify them before Salesforce customer data is treated as canonical.
          </span>
          <Link className="text-link" to="/crm/integrations/salesforce">Review Salesforce organizations</Link>
        </div>
      ) : null}

      {hubSpot && !hubSpotVerified && hubSpot.state !== 'unconfigured' ? (
        <div className={`crm-banner ${hubSpot.state}`} role="status">
          <strong>HubSpot · {stateLabel[hubSpot.state]}</strong>
          <span>
            {hubSpot.state === 'degraded'
              ? 'The provider is reachable, but one or more authorized CRM capabilities are unavailable.'
              : hubSpot.state === 'expired'
                ? 'The provider credential must be re-authorized before CRM records can be read.'
                : hubSpot.state === 'revoked'
                  ? 'This organization disconnected its CRM provider.'
                  : hubSpot.state === 'authorizing'
                    ? 'Provider authorization has started but is not yet verified.'
                    : hubSpot.state === 'error'
                      ? `Connection verification failed${hubSpot.safeErrorCode ? ` (${hubSpot.safeErrorCode})` : ''}.`
                      : 'HubSpot verification is required before customer records are available.'}
          </span>
          <Link className="text-link" to="/crm/integrations/hubspot">Open HubSpot connection</Link>
        </div>
      ) : null}

      {!loading && !anyVerified && !salesforce?.canonicalRequired ? (
        <div className="crm-banner neutral" role="status">
          <strong>No verified CRM provider</strong>
          <span>Connect HubSpot or Salesforce before provider-backed customer records are available.</span>
          <Link className="text-link" to="/crm/integrations">Open CRM integrations</Link>
        </div>
      ) : null}

      {hubSpot && hubSpotVerified ? (
        <div className="crm-banner connected" role="status">
          <strong>HubSpot verified</strong>
          <span>{hubSpot.providerAccountLabel || 'Authorized HubSpot account'}</span>
          <small>Verified {new Date(hubSpot.lastVerifiedAt as string).toLocaleString()}</small>
          <Link className="text-link" to="/crm/contacts">Open HubSpot CRM</Link>
        </div>
      ) : null}

      {salesforce && salesforceVerified ? (
        <div className="crm-banner connected" role="status">
          <strong>Salesforce verified</strong>
          <span>{salesforce.connection.providerAccountLabel || 'Authorized Salesforce organization'}</span>
          <small>Verified {new Date(salesforce.connection.lastVerifiedAt as string).toLocaleString()}</small>
          <Link className="text-link" to="/crm/salesforce/contacts">Open Salesforce CRM</Link>
        </div>
      ) : null}
    </ModuleExperiencePage>
  );
}
