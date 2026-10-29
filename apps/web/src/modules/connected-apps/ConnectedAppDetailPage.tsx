import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  disconnectConnectedApp,
  getConnectedApp,
  listConnectedAppAudit,
  listConnectedAppRetention,
  verifyConnectedApp
} from '../../lib/connectedAppsApi';
import './connected-apps.css';

export function ConnectedAppDetailPage() {
  const { connectionId = '' } = useParams();
  const [connection, setConnection] = useState<Record<string, any> | null>(null);
  const [activity, setActivity] = useState<any[]>([]);
  const [retention, setRetention] = useState<any[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [busy, setBusy] = useState(false);

  async function reload() {
    setState('loading');
    try {
      const [detail, audit, ledger] = await Promise.all([
        getConnectedApp(connectionId),
        listConnectedAppAudit(),
        listConnectedAppRetention()
      ]);
      setConnection((detail as any).connection || null);
      setActivity(Array.isArray((audit as any).audit) ? (audit as any).audit.filter((item: any) => item.connection_id === connectionId) : []);
      setRetention(Array.isArray((ledger as any).retention) ? (ledger as any).retention.filter((item: any) => item.connection_id === connectionId) : []);
      setState('ready');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'connected_app_unavailable');
      setState('error');
    }
  }

  useEffect(() => { void reload(); }, [connectionId]);

  async function verify() {
    setBusy(true);
    try { await verifyConnectedApp(connectionId); await reload(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'verification_failed'); }
    finally { setBusy(false); }
  }

  async function disconnect() {
    setBusy(true);
    try {
      await disconnectConnectedApp(connectionId);
      setConfirmDisconnect(false);
      await reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'disconnect_failed');
    } finally { setBusy(false); }
  }

  if (state === 'loading') return <section className="page-stack"><div className="notice" role="status">Loading connection…</div></section>;
  if (state === 'error' || !connection) return <section className="page-stack"><div className="notice warning" role="alert">Connection unavailable: {error || 'not_found'}</div><Link to="/settings/connected-apps">Back to Connected Apps</Link></section>;

  const scopes = Array.isArray(connection.granted_scopes) ? connection.granted_scopes : [];
  return (
    <section className="connected-apps-page page-stack">
      <header className="page-header">
        <p className="eyebrow">Connected Apps · Connection</p>
        <h1>{connection.provider_account_label || connection.provider}</h1>
        <p>Organization-scoped provider access with explicit scopes, readiness, activity and retention evidence.</p>
      </header>

      {error && <div className="notice warning" role="alert">{error}</div>}

      <div className="connected-app-detail-grid">
        <article className="feature-card"><h2>Overview</h2><p>Status: <strong>{connection.state}</strong></p><p>Provider: {connection.provider}</p><button type="button" onClick={verify} disabled={busy}>Verify connection</button></article>
        <article className="feature-card"><h2>Permissions &amp; Scopes</h2>{scopes.length ? <ul>{scopes.map((scope: string) => <li key={scope}>{scope}</li>)}</ul> : <p>No verified provider scopes.</p>}</article>
        <article className="feature-card"><h2>Capabilities</h2><p>Capabilities are usable only when the provider is connected, verified and sufficiently scoped.</p></article>
        <article className="feature-card"><h2>Agent &amp; Workflow Access</h2><p>ATLAS AI and Work receive policy-filtered capability codes only. Credentials are never exposed to agents.</p></article>
        <article className="feature-card"><h2>Activity</h2><p>{activity.length} recorded access events for this connection.</p></article>
        <article className="feature-card"><h2>Data &amp; Retention</h2><p>{retention.length} provenance or retention records.</p></article>
      </div>

      <section className="feature-card danger-zone" aria-labelledby="disconnect-title">
        <h2 id="disconnect-title">Disconnect</h2>
        <p>Disconnecting stops future ATLAS access immediately. Provider token revocation is attempted only when supported and is reported separately. ATLAS-retained data is not automatically represented as deleted, and data held by the external provider may remain there.</p>
        {!confirmDisconnect ? <button type="button" onClick={() => setConfirmDisconnect(true)}>Disconnect app</button> : (
          <div className="disconnect-confirmation" role="group" aria-label="Confirm disconnect">
            <p><strong>Confirm disconnect:</strong> stop future ATLAS use of this connection now.</p>
            <button type="button" onClick={disconnect} disabled={busy}>Confirm disconnect</button>
            <button type="button" onClick={() => setConfirmDisconnect(false)} disabled={busy}>Cancel</button>
          </div>
        )}
      </section>
    </section>
  );
}
