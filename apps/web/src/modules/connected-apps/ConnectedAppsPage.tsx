import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listConnectedApps } from '../../lib/connectedAppsApi';
import './connected-apps.css';

type CapabilityView = { code: string; usable?: boolean; missingScopes?: string[] };
type AppView = {
  providerId: string;
  displayName: string;
  runtimeStatus: string;
  connectionId?: string | null;
  status: string;
  accountLabel?: string | null;
  lastVerifiedAt?: string | null;
  capabilities?: CapabilityView[];
};

function statusLabel(status: string) {
  if (status === 'connected') return 'Connected';
  if (status === 'degraded') return 'Degraded';
  if (status === 'expired') return 'Expired';
  if (status === 'authorizing') return 'Authorizing';
  if (status === 'revoked') return 'Revoked';
  if (status === 'error') return 'Error';
  return 'Disconnected';
}

export function ConnectedAppsPage() {
  const [apps, setApps] = useState<AppView[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    listConnectedApps()
      .then((result: any) => {
        if (!active) return;
        setApps(Array.isArray(result.apps) ? result.apps : []);
        setState('ready');
      })
      .catch((cause) => {
        if (!active) return;
        setError(cause instanceof Error ? cause.message : 'connected_apps_unavailable');
        setState('error');
      });
    return () => { active = false; };
  }, []);

  return (
    <section className="connected-apps-page page-stack">
      <header className="page-header">
        <p className="eyebrow">Settings · Security · External access</p>
        <h1>Connected Apps</h1>
        <p>Connect external applications through ATLAS Identity, organization-scoped permissions, verified provider readiness and auditable execution policy.</p>
      </header>

      {state === 'loading' && <div className="notice" role="status">Loading Connected Apps…</div>}
      {state === 'error' && <div className="notice warning" role="alert">Connected Apps could not be loaded: {error}</div>}
      {state === 'ready' && apps.length === 0 && <div className="empty-state"><strong>No connected applications</strong><span>The catalog has no available providers for this organization.</span></div>}

      <div className="connected-app-grid" aria-live="polite">
        {apps.map((app) => {
          const missing = (app.capabilities || []).flatMap((capability) => capability.missingScopes || []);
          const detailId = app.connectionId || app.providerId;
          return (
            <article key={app.providerId} className="connected-app-card" data-testid={`connected-app-${app.providerId}`}>
              <div className="connected-app-card__header">
                <div><span className="eyebrow">{app.runtimeStatus === 'catalog_only' ? 'Catalog only' : 'Provider'}</span><h2>{app.displayName}</h2></div>
                <span className={`status-chip connected-app-status status-${app.status}`}>{statusLabel(app.status)}</span>
              </div>
              {app.accountLabel && <p><strong>Connected account:</strong> {app.accountLabel}</p>}
              {!app.accountLabel && <p className="muted">No authorized account is attached to this organization.</p>}
              {app.lastVerifiedAt && <p className="muted">Last verified: {new Date(app.lastVerifiedAt).toLocaleString()}</p>}
              {missing.length > 0 && (
                <div className="connected-app-warning" role="status">
                  <strong>Missing scope</strong>
                  <span>{[...new Set(missing)].join(', ')}</span>
                </div>
              )}
              <div className="connected-app-capabilities" aria-label={`${app.displayName} capabilities`}>
                {(app.capabilities || []).map((capability) => (
                  <span key={capability.code} className={capability.usable ? 'capability-chip usable' : 'capability-chip gated'}>
                    {capability.code}
                  </span>
                ))}
              </div>
              <div className="connected-app-actions">
                {app.runtimeStatus === 'catalog_only' ? (
                  <button type="button" disabled title="Runtime adapter is not verified">Connect unavailable</button>
                ) : app.status === 'connected' || app.connectionId ? (
                  <Link className="text-link" to={`/settings/connected-apps/${encodeURIComponent(detailId)}`}>Manage {app.displayName}</Link>
                ) : (
                  <Link className="text-link" to={`/settings/connected-apps/${encodeURIComponent(detailId)}`}>Connect {app.displayName}</Link>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
