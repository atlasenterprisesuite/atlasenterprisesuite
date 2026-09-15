import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { CrmConnectionView } from '../../../../../../packages/core/src/crm';
import { CrmApiError, crmApi } from './crmApi';

const workspaces = [
  { to: '/crm/contacts', title: 'Contacts', description: 'Customer people and relationship context.' },
  { to: '/crm/companies', title: 'Accounts', description: 'Company and account relationship context.' },
  { to: '/crm/deals', title: 'Opportunities', description: 'Deal pipeline records from the connected provider.' },
  { to: '/crm/service', title: 'Service Cases', description: 'Ticket and service history where scope permits.' },
  { to: '/crm/activities', title: 'Activities', description: 'Tasks, calls, meetings, notes and email activity.' },
  { to: '/crm/integrations', title: 'Integrations', description: 'Connection readiness and provider controls.' }
] as const;

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
    <section className="crm-page page-stack" aria-labelledby="crm-title">
      <header className="page-header crm-hero">
        <div>
          <p className="eyebrow">ATLAS Business Suite</p>
          <h1 id="crm-title">ATLAS CRM</h1>
          <p>Governed customer operations using the authenticated ATLAS organization and provider-backed data only.</p>
        </div>
        <div className="crm-connection-summary" aria-live="polite">
          {loading ? (
            <span className="crm-status neutral">Checking connection</span>
          ) : error ? (
            <span className="crm-status error">Status unavailable</span>
          ) : connection ? (
            <span className={`crm-status ${connection.state}`}>{stateLabel[connection.state]}</span>
          ) : null}
        </div>
      </header>

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

      <nav className="module-grid" aria-label="CRM workspaces">
        {workspaces.map((item) => (
          <Link key={item.to} className="module-card enabled" to={item.to}>
            <span>CRM</span><strong>{item.title}</strong><p>{item.description}</p>
          </Link>
        ))}
      </nav>

      <div className="notice">No pipeline totals, revenue, customer counts or activity metrics are shown unless they come from an authorized live provider response.</div>
    </section>
  );
}
