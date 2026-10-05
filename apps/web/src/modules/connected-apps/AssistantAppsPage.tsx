import { useEffect, useState } from 'react';
import { listAssistantConnectedApps } from '../../lib/connectedAppsApi';
import './connected-apps.css';

export function AssistantAppsPage() {
  const [apps, setApps] = useState<any[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    listAssistantConnectedApps()
      .then((value: any) => {
        if (!active) return;
        setApps(Array.isArray(value.apps) ? value.apps : []);
        setState('ready');
      })
      .catch((cause) => {
        if (!active) return;
        setError(cause instanceof Error ? cause.message : 'assistant_apps_unavailable');
        setState('error');
      });
    return () => { active = false; };
  }, []);

  return (
    <section className="connected-apps-page page-stack">
      <header className="page-header"><p className="eyebrow">ATLAS AI · Apps</p><h1>Authorized Apps</h1><p>Only capabilities allowed by the active organization, current identity and server-side policy are visible to ATLAS AI.</p></header>
      {state === 'loading' && <div className="notice" role="status">Loading authorized apps…</div>}
      {state === 'error' && <div className="notice warning" role="alert">Authorized apps could not be loaded: {error}</div>}
      {state === 'ready' && apps.length === 0 && <div className="empty-state"><strong>No agent-usable connections</strong><span>Connect and verify an application, then authorize ATLAS AI access through policy.</span></div>}
      <div className="connected-app-grid">
        {apps.map((app) => (
          <article key={app.providerId} className="connected-app-card">
            <div className="connected-app-card__header"><div><span className="eyebrow">{app.health}</span><h2>{app.displayName}</h2></div></div>
            {app.accountLabel && <p>{app.accountLabel}</p>}
            {app.verifiedAt && <p className="muted">Verified: {new Date(app.verifiedAt).toLocaleString()}</p>}
            <div className="connected-app-capabilities">
              {(app.capabilities || []).map((capability: any) => (
                <div key={capability.code} className="assistant-capability">
                  <strong>{capability.code}</strong>
                  <span>{capability.approvalRequired ? 'Approval required' : 'No approval required'}</span>
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
