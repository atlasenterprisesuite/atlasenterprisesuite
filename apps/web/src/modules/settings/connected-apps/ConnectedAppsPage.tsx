import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  beginIntegrationAuthorization,
  listIntegrationConnections,
  type BrowserIntegrationConnection
} from '../../../lib/integrationsApi';

const providers = [
  { key: 'microsoft', name: 'Microsoft', className: 'user_oauth', description: 'Microsoft identity and Graph capabilities.' },
  { key: 'google', name: 'Google', className: 'user_oauth', description: 'Workspace, Drive, Calendar and Gmail capability boundary.' },
  { key: 'github', name: 'GitHub', className: 'user_oauth', description: 'Repository, issue and pull-request capability boundary.' },
  { key: 'cloudflare', name: 'Cloudflare', className: 'infrastructure', description: 'Infrastructure connection for governed edge operations.' },
  { key: 'supabase', name: 'Supabase', className: 'infrastructure', description: 'Infrastructure connection for governed data-platform operations.' }
] as const;

function statusLabel(status: string) {
  if (status === 'verified') return 'Verified';
  if (status === 'connected_unverified') return 'Connected · verification required';
  if (status === 'reconnect_required') return 'Reconnect required';
  if (status === 'degraded') return 'Degraded';
  if (status === 'expired') return 'Expired';
  if (status === 'revoked') return 'Revoked';
  return 'Not connected';
}

export function ConnectedAppsPage() {
  const [connections, setConnections] = useState<BrowserIntegrationConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyProvider, setBusyProvider] = useState('');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const rows = await listIntegrationConnections();
        if (!cancelled) setConnections(rows);
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'integration_load_failed');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const byProvider = useMemo(() => new Map(connections.map((row) => [row.providerKey, row])), [connections]);

  async function connectMicrosoft() {
    setBusyProvider('microsoft');
    setError('');
    try {
      const { authorizationUrl } = await beginIntegrationAuthorization('microsoft', ['microsoft.profile.read']);
      window.location.assign(authorizationUrl);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'authorization_start_failed');
      setBusyProvider('');
    }
  }

  return (
    <section className="connected-apps-page page-stack" aria-labelledby="connected-apps-title">
      <header className="page-header">
        <p className="eyebrow">Settings · Security</p>
        <h1 id="connected-apps-title">Connected Apps</h1>
        <p>Authorize external systems through one governed ATLAS Integration Gateway. Connection state is shown only from real provider and server evidence.</p>
      </header>

      {error ? <div className="connected-apps-alert" role="alert">{error}</div> : null}
      {loading ? <div className="connected-apps-loading" role="status">Loading connected apps…</div> : null}

      <div className="connected-apps-grid">
        {providers.map((provider) => {
          const connection = byProvider.get(provider.key);
          const microsoft = provider.key === 'microsoft';
          const status = connection ? statusLabel(connection.status) : microsoft ? 'Not connected' : 'Not configured';
          return (
            <article key={provider.key} className="connected-app-card">
              <div className="connected-app-card-heading">
                <div>
                  <span className="connected-app-kind">{provider.className === 'infrastructure' ? 'Infrastructure' : 'User OAuth'}</span>
                  <h2>{provider.name}</h2>
                </div>
                <span className={`connected-app-status status-${connection?.status || 'not-connected'}`}>{status}</span>
              </div>
              <p>{provider.description}</p>
              {connection?.maskedIdentity ? <p className="connected-app-identity">{connection.maskedIdentity}</p> : null}
              <div className="connected-app-actions">
                {microsoft && !connection ? (
                  <button type="button" onClick={connectMicrosoft} disabled={busyProvider === 'microsoft'}>
                    {busyProvider === 'microsoft' ? 'Opening Microsoft…' : 'Connect Microsoft'}
                  </button>
                ) : null}
                {microsoft && connection ? (
                  <Link className="connected-app-link" to="/settings/security/connected-apps/microsoft">Manage</Link>
                ) : null}
                {!microsoft ? <button type="button" disabled aria-disabled="true">Not configured</button> : null}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
