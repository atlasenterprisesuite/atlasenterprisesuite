import { useEffect, useState } from 'react';
import { loadExternalAccess } from '../../lib/connectedAppsApi';
import './connected-apps.css';

export function ExternalAccessPage() {
  const [data, setData] = useState<{ connections: any[]; recentDecisions: any[]; retentionExceptions: any[] }>({ connections: [], recentDecisions: [], retentionExceptions: [] });
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    loadExternalAccess()
      .then((value: any) => {
        if (!active) return;
        setData({
          connections: Array.isArray(value.connections) ? value.connections : [],
          recentDecisions: Array.isArray(value.recentDecisions) ? value.recentDecisions : [],
          retentionExceptions: Array.isArray(value.retentionExceptions) ? value.retentionExceptions : []
        });
        setState('ready');
      })
      .catch((cause) => {
        if (!active) return;
        setError(cause instanceof Error ? cause.message : 'external_access_unavailable');
        setState('error');
      });
    return () => { active = false; };
  }, []);

  return (
    <section className="connected-apps-page page-stack">
      <header className="page-header"><p className="eyebrow">Security · Governance</p><h1>External Access</h1><p>Organization-wide visibility into connected providers, degraded access, consequential capabilities, policy decisions and retention exceptions.</p></header>
      {state === 'loading' && <div className="notice" role="status">Loading external access…</div>}
      {state === 'error' && <div className="notice warning" role="alert">External access could not be loaded: {error}</div>}
      {state === 'ready' && (
        <>
          <div className="connected-app-detail-grid">
            {data.connections.map((connection: any) => (
              <article key={connection.id || `${connection.provider}-${connection.connection_name || ''}`} className="feature-card">
                <p className="eyebrow">{connection.provider || connection.displayName}</p>
                <h2>{connection.displayName || connection.provider}</h2>
                <p>Status: <strong>{connection.status || connection.state || 'unknown'}</strong></p>
                {Array.isArray(connection.highRiskCapabilities) && connection.highRiskCapabilities.length > 0 && <p>High-risk: {connection.highRiskCapabilities.join(', ')}</p>}
                {connection.policyEffect && <p>Policy: {String(connection.policyEffect).replaceAll('_', ' ')}</p>}
              </article>
            ))}
          </div>
          <section className="feature-card"><h2>Recent policy decisions</h2>{data.recentDecisions.length === 0 ? <p>No recent decisions.</p> : <ul>{data.recentDecisions.map((item: any) => <li key={item.id}>{item.provider || item.connection_id}: {item.capabilityCode || item.capability_code} — {String(item.decision || '').replaceAll('_', ' ')}</li>)}</ul>}</section>
          <section className="feature-card"><h2>Retention exceptions</h2><p>{data.retentionExceptions.length} items require lifecycle attention.</p></section>
        </>
      )}
    </section>
  );
}
