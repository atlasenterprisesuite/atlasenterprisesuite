import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  beginIntegrationAuthorization,
  getIntegrationConnection,
  revokeIntegration,
  verifyIntegration,
  type BrowserIntegrationConnection
} from '../../../lib/integrationsApi';

const tabs = ['Overview', 'Permissions', 'Used By', 'Activity', 'Security'] as const;
type Tab = typeof tabs[number];

function statusLabel(status: string) {
  if (status === 'verified') return 'Verified';
  if (status === 'connected_unverified') return 'Connected · verification required';
  if (status === 'reconnect_required') return 'Reconnect required';
  if (status === 'degraded') return 'Degraded';
  if (status === 'expired') return 'Expired';
  if (status === 'revoked') return 'Revoked';
  return 'Not connected';
}

function dateLabel(value: string | null) {
  if (!value) return 'Not available';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Not available' : date.toLocaleString();
}

export function ProviderDetailPage() {
  const { providerKey = '' } = useParams();
  const provider = providerKey.trim().toLowerCase();
  const supported = provider === 'microsoft';
  const [connection, setConnection] = useState<BrowserIntegrationConnection | null>(null);
  const [loading, setLoading] = useState(supported);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<Tab>('Overview');
  const [providerManagementUrl, setProviderManagementUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!supported) return;
    let cancelled = false;
    void (async () => {
      try {
        const row = await getIntegrationConnection('microsoft');
        if (!cancelled) setConnection(row);
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'integration_load_failed');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [supported]);

  const canVerify = Boolean(connection && connection.status !== 'revoked');
  const canReconnect = Boolean(connection);
  const scopeSummary = useMemo(() => connection?.scopes || [], [connection]);

  async function connectOrReconnect() {
    setBusy('authorize');
    setError('');
    try {
      const { authorizationUrl } = await beginIntegrationAuthorization('microsoft', ['microsoft.profile.read']);
      window.location.assign(authorizationUrl);
    } catch (cause) {
      setBusy('');
      setError(cause instanceof Error ? cause.message : 'authorization_start_failed');
    }
  }

  async function verifyNow() {
    setBusy('verify');
    setError('');
    try {
      setConnection(await verifyIntegration('microsoft'));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'verification_failed');
    } finally {
      setBusy('');
    }
  }

  async function revokeNow() {
    if (!window.confirm('Revoke Microsoft access from ATLAS? This immediately disables ATLAS use of the stored authorization.')) return;
    setBusy('revoke');
    setError('');
    try {
      const result = await revokeIntegration('microsoft');
      setConnection(result.connection);
      setProviderManagementUrl(result.providerManagementUrl);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'revoke_failed');
    } finally {
      setBusy('');
    }
  }

  if (!supported) {
    return (
      <section className="connected-apps-page page-stack">
        <header className="page-header"><p className="eyebrow">Settings · Security</p><h1>Provider not configured</h1><p>This provider does not yet have an executable Connected Apps adapter in this milestone.</p></header>
        <Link className="connected-app-link" to="/settings/security/connected-apps">Back to Connected Apps</Link>
      </section>
    );
  }

  return (
    <section className="connected-apps-page page-stack" aria-labelledby="provider-detail-title">
      <header className="page-header provider-detail-header">
        <div>
          <p className="eyebrow">Connected Apps</p>
          <h1 id="provider-detail-title">Microsoft</h1>
          <p>OAuth access is mediated by ATLAS. Provider credentials never render in this page.</p>
        </div>
        <span className={`connected-app-status status-${connection?.status || 'not-connected'}`}>
          {loading ? 'Checking…' : connection ? statusLabel(connection.status) : 'Not connected'}
        </span>
      </header>

      {error ? <div className="connected-apps-alert" role="alert">{error}</div> : null}

      <div className="connected-app-actions provider-actions">
        {!connection ? <button type="button" onClick={connectOrReconnect} disabled={busy === 'authorize'}>Connect Microsoft</button> : null}
        {canReconnect ? <button type="button" onClick={connectOrReconnect} disabled={Boolean(busy)}>{busy === 'authorize' ? 'Opening Microsoft…' : 'Reconnect'}</button> : null}
        {canVerify ? <button type="button" onClick={verifyNow} disabled={Boolean(busy)}>{busy === 'verify' ? 'Verifying…' : 'Verify now'}</button> : null}
        {connection && connection.status !== 'revoked' ? <button type="button" className="danger-action" onClick={revokeNow} disabled={Boolean(busy)}>{busy === 'revoke' ? 'Revoking…' : 'Revoke from ATLAS'}</button> : null}
        {providerManagementUrl ? <a className="connected-app-link" href={providerManagementUrl} rel="noreferrer">Manage at Microsoft</a> : null}
        <Link className="connected-app-link" to="/settings/security/connected-apps">All providers</Link>
      </div>

      <div className="connected-app-tabs" role="tablist" aria-label="Microsoft connection details">
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            className={activeTab === tab ? 'active' : ''}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="connected-app-tab-panel" role="tabpanel">
        {activeTab === 'Overview' ? (
          <dl className="connected-app-detail-list">
            <div><dt>Status</dt><dd>{connection ? statusLabel(connection.status) : 'Not connected'}</dd></div>
            <div><dt>Account</dt><dd>{connection?.maskedIdentity || 'No account connected'}</dd></div>
            <div><dt>Connected</dt><dd>{dateLabel(connection?.connectedAt || null)}</dd></div>
            <div><dt>Last verified</dt><dd>{dateLabel(connection?.lastVerifiedAt || null)}</dd></div>
          </dl>
        ) : null}
        {activeTab === 'Permissions' ? (
          scopeSummary.length ? <ul className="connected-app-scope-list">{scopeSummary.map((scope) => <li key={scope}>{scope}</li>)}</ul> : <p>No provider scopes are currently recorded.</p>
        ) : null}
        {activeTab === 'Used By' ? <p>Usage grants are governed separately and are shown only when active ATLAS grants exist.</p> : null}
        {activeTab === 'Activity' ? <p>Connection activity is metadata-only and never includes provider tokens or authorization codes.</p> : null}
        {activeTab === 'Security' ? (
          <div className="security-boundary-copy"><strong>Credential boundary</strong><p>OAuth tokens remain server-side, organization-scoped and inaccessible to ordinary browser queries.</p></div>
        ) : null}
      </div>
    </section>
  );
}
