import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { CrmConnectionView } from '../../../../../../packages/core/src/crm';
import { ModuleExperiencePage, type ModuleExperienceSection } from '../../../components/ModuleExperiencePage';
import { CrmApiError, crmApi } from './crmApi';

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
  const [connection, setConnection] = useState<CrmConnectionView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    crmApi<{ connection: CrmConnectionView }>('connection.status')
      .then((result) => {
        if (!active) return;
        setConnection(result.connection);
        setError(null);
      })
      .catch((caught: unknown) => {
        if (!active) return;
        setError(caught instanceof CrmApiError ? caught.message : 'CRM connection status is unavailable');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

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
        {loading ? (
          <span className="crm-status neutral">Checking connection</span>
        ) : error ? (
          <span className="crm-status error">Status unavailable</span>
        ) : connection ? (
          <span className={`crm-status ${connection.state}`}>{stateLabel[connection.state]}</span>
        ) : null}
      </div>

      {error ? <div className="crm-banner error" role="alert">{error}</div> : null}
      {connection && connection.state !== 'connected' ? (
        <div className={`crm-banner ${connection.state}`} role="status">
          <strong>{stateLabel[connection.state]}</strong>
          <span>
            {connection.state === 'degraded'
              ? 'The provider is reachable, but one or more authorized CRM capabilities are unavailable.'
              : connection.state === 'expired'
                ? 'The provider credential must be re-authorized before CRM records can be read.'
                : connection.state === 'revoked'
                  ? 'This organization disconnected its CRM provider.'
                  : connection.state === 'authorizing'
                    ? 'Provider authorization has started but is not yet verified.'
                    : connection.state === 'error'
                      ? `Connection verification failed${connection.safeErrorCode ? ` (${connection.safeErrorCode})` : ''}.`
                      : 'Connect and verify a CRM provider before customer records are available.'}
          </span>
          <Link className="text-link" to="/crm/integrations/hubspot">Open HubSpot connection</Link>
        </div>
      ) : null}

      {connection?.state === 'connected' ? (
        <div className="crm-banner connected" role="status">
          <strong>HubSpot verified</strong>
          <span>{connection.providerAccountLabel || 'Authorized provider account'}</span>
          {connection.lastVerifiedAt ? <small>Verified {new Date(connection.lastVerifiedAt).toLocaleString()}</small> : null}
        </div>
      ) : null}
    </ModuleExperiencePage>
  );
}
