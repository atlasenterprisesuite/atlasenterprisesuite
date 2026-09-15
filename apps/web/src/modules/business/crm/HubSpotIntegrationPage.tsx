import { useCallback, useEffect, useState } from 'react';
import type { CrmConnectionView } from '../../../../../../packages/core/src/crm';
import { CrmApiError, crmApi } from './crmApi';

const connectionLabel: Record<CrmConnectionView['state'], string> = {
  unconfigured: 'Not configured',
  authorizing: 'Authorizing',
  connected: 'Connected',
  degraded: 'Degraded',
  expired: 'Expired',
  revoked: 'Revoked',
  error: 'Error'
};

function safeError(error: unknown): string {
  if (error instanceof CrmApiError) {
    return error.code ? `${error.message} (${error.code})` : error.message;
  }
  return 'HubSpot connection operation failed.';
}

function verifiedHubSpotAuthorizationUrl(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error('HubSpot authorization URL was not returned');
  }
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.hostname !== 'app.hubspot.com' || !url.pathname.startsWith('/oauth/authorize')) {
    throw new Error('HubSpot authorization URL is invalid');
  }
  return url.toString();
}

export function HubSpotIntegrationPage() {
  const [connection, setConnection] = useState<CrmConnectionView | null>(null);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState<'authorizing' | 'verifying' | 'disconnecting' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  const refreshStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await crmApi<{ connection: CrmConnectionView }>('connection.status');
      setConnection(result.connection);
    } catch (caught) {
      setError(safeError(caught));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  const connect = async () => {
    setAction('authorizing');
    setError(null);
    try {
      const result = await crmApi<{ authorizationUrl: string }>('oauth.prepare');
      const authorizationUrl = verifiedHubSpotAuthorizationUrl(result.authorizationUrl);
      window.location.assign(authorizationUrl);
    } catch (caught) {
      setError(safeError(caught));
      setAction(null);
    }
  };

  const verifyAgain = async () => {
    setAction('verifying');
    setError(null);
    try {
      const result = await crmApi<{ connection: CrmConnectionView }>('crm.refresh');
      setConnection(result.connection);
    } catch (caught) {
      setError(safeError(caught));
    } finally {
      setAction(null);
    }
  };

  const disconnect = async () => {
    setAction('disconnecting');
    setError(null);
    try {
      const result = await crmApi<{ connection: CrmConnectionView }>('connection.disconnect');
      setConnection(result.connection);
      setConfirmDisconnect(false);
    } catch (caught) {
      setError(safeError(caught));
    } finally {
      setAction(null);
    }
  };

  const state = connection?.state ?? 'unconfigured';
  const connectDisabled = loading || action !== null;
  const canDisconnect = connection && !['unconfigured', 'revoked'].includes(connection.state);

  return (
    <section className="crm-page page-stack" aria-labelledby="hubspot-integration-title">
      <header className="page-header crm-hero">
        <div>
          <p className="eyebrow">ATLAS CRM · Integration</p>
          <h1 id="hubspot-integration-title">HubSpot Integration</h1>
          <p>OAuth connection, provider verification and governed disconnect for this ATLAS organization.</p>
        </div>
        <span className={`crm-status ${state}`} aria-live="polite">
          {action === 'authorizing' ? 'Authorizing' : connectionLabel[state]}
        </span>
      </header>

      {loading ? <div className="crm-loading" role="status">Loading HubSpot connection status…</div> : null}
      {error ? <div className="crm-banner error" role="alert">{error}</div> : null}

      {!loading && connection ? (
        <dl className="crm-field-grid" aria-label="HubSpot connection metadata">
          <div><dt>State</dt><dd>{connectionLabel[connection.state]}</dd></div>
          <div><dt>Provider account</dt><dd>{connection.providerAccountLabel || 'Not provided'}</dd></div>
          <div><dt>Provider account ID</dt><dd>{connection.providerAccountId || 'Not provided'}</dd></div>
          <div><dt>Verified</dt><dd>{connection.lastVerifiedAt ? new Date(connection.lastVerifiedAt).toLocaleString() : 'Not verified'}</dd></div>
          <div><dt>Last successful provider operation</dt><dd>{connection.lastSuccessAt ? new Date(connection.lastSuccessAt).toLocaleString() : 'None recorded'}</dd></div>
          <div><dt>Safe error code</dt><dd>{connection.safeErrorCode || 'None'}</dd></div>
        </dl>
      ) : null}

      {!loading && connection ? (
        <section className="crm-scope-panel" aria-labelledby="hubspot-scopes-title">
          <h2 id="hubspot-scopes-title">Granted scopes</h2>
          {connection.grantedScopes.length === 0 ? (
            <p>No provider scopes are recorded.</p>
          ) : (
            <ul>{connection.grantedScopes.map((scope) => <li key={scope}><code>{scope}</code></li>)}</ul>
          )}
        </section>
      ) : null}

      <div className="crm-actions" aria-label="HubSpot connection actions">
        <button type="button" onClick={() => void connect()} disabled={connectDisabled}>
          {action === 'authorizing' ? 'Authorizing…' : connection?.state === 'connected' ? 'Reconnect HubSpot' : 'Connect HubSpot'}
        </button>
        <button type="button" onClick={() => void verifyAgain()} disabled={loading || action !== null || !connection || connection.state === 'unconfigured'}>
          {action === 'verifying' ? 'Verifying…' : 'Retry verification'}
        </button>
        <button type="button" onClick={() => void refreshStatus()} disabled={loading || action !== null}>
          Refresh status
        </button>
        {canDisconnect ? (
          <button type="button" className="danger" onClick={() => setConfirmDisconnect(true)} disabled={action !== null}>
            Disconnect HubSpot
          </button>
        ) : null}
      </div>

      {confirmDisconnect ? (
        <div className="crm-dialog-backdrop" role="presentation">
          <div className="crm-dialog" role="dialog" aria-modal="true" aria-labelledby="disconnect-hubspot-title">
            <h2 id="disconnect-hubspot-title">Disconnect HubSpot?</h2>
            <p>ATLAS will attempt provider revocation and will remove its encrypted credential material. CRM reads will stop for this organization.</p>
            <div className="crm-actions">
              <button type="button" onClick={() => setConfirmDisconnect(false)} disabled={action === 'disconnecting'}>Cancel</button>
              <button type="button" className="danger" onClick={() => void disconnect()} disabled={action === 'disconnecting'}>
                {action === 'disconnecting' ? 'Disconnecting…' : 'Disconnect'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="notice">Provider access tokens, refresh tokens, client secrets and encryption keys are never rendered by this page.</div>
    </section>
  );
}
