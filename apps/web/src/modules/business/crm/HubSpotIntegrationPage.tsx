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

type HubSpotOAuthConfiguration = {
  configured: boolean;
  redirectUri: string;
};

export function HubSpotIntegrationPage() {
  const [connection, setConnection] = useState<CrmConnectionView | null>(null);
  const [configuration, setConfiguration] = useState<HubSpotOAuthConfiguration | null>(null);
  const [oauthClientId, setOauthClientId] = useState('');
  const [oauthClientSecret, setOauthClientSecret] = useState('');
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState<'configuring' | 'authorizing' | 'verifying' | 'disconnecting' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  const refreshStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [statusResult, configurationResult] = await Promise.all([
        crmApi<{ connection: CrmConnectionView }>('connection.status'),
        crmApi<HubSpotOAuthConfiguration>('connection.configuration')
      ]);
      setConnection(statusResult.connection);
      setConfiguration(configurationResult);
    } catch (caught) {
      setError(safeError(caught));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  const configureOAuth = async () => {
    setAction('configuring');
    setError(null);
    try {
      const result = await crmApi<HubSpotOAuthConfiguration>('oauth.configure', {
        clientId: oauthClientId,
        clientSecret: oauthClientSecret
      });
      setConfiguration(result);
      setOauthClientSecret('');
    } catch (caught) {
      setError(safeError(caught));
    } finally {
      setAction(null);
    }
  };

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
  const connectDisabled = loading || action !== null || configuration?.configured !== true;
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

      {!loading && configuration && !configuration.configured ? (
        <section className="crm-scope-panel" aria-labelledby="hubspot-oauth-app-setup">
          <h2 id="hubspot-oauth-app-setup">HubSpot OAuth app setup</h2>
          <p>
            Enter the OAuth credentials from the HubSpot developer app. The secret is sent directly
            to the ATLAS backend and stored encrypted in Supabase Vault; it is not saved in browser storage.
          </p>
          <dl className="crm-field-grid">
            <div><dt>Redirect URI</dt><dd><code>{configuration.redirectUri}</code></dd></div>
          </dl>
          <div className="crm-form-grid">
            <label>
              Client ID
              <input
                value={oauthClientId}
                onChange={(event) => setOauthClientId(event.target.value)}
                autoComplete="off"
                spellCheck={false}
              />
            </label>
            <label>
              Client Secret
              <input
                type="password"
                value={oauthClientSecret}
                onChange={(event) => setOauthClientSecret(event.target.value)}
                autoComplete="new-password"
                spellCheck={false}
              />
            </label>
          </div>
          <div className="crm-actions">
            <button
              type="button"
              onClick={() => void configureOAuth()}
              disabled={action !== null || !oauthClientId.trim() || oauthClientSecret.trim().length < 8}
            >
              {action === 'configuring' ? 'Saving securely…' : 'Save OAuth configuration'}
            </button>
          </div>
        </section>
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

      <div className="notice">
        Provider access tokens, refresh tokens and encryption keys are never rendered by this page.
        OAuth client secrets are accepted only through the masked setup field and are cleared after secure backend storage.
      </div>
    </section>
  );
}
