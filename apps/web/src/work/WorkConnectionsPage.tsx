import { FormEvent, useCallback, useEffect, useState } from 'react';
import { listWorkConnections, registerWorkConnectionRef, revokeWorkConnectionRef, type WorkConnectionSummary } from './api';
import { WorkSubnav } from './WorkSubnav';

export function WorkConnectionsPage() {
  const [connections, setConnections] = useState<WorkConnectionSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [provider, setProvider] = useState('');
  const [mechanism, setMechanism] = useState<WorkConnectionSummary['mechanism']>('oauth');
  const [externalRef, setExternalRef] = useState('');
  const [capabilities, setCapabilities] = useState('');

  const refresh = useCallback(async () => {
    setError(null);
    try { setConnections(await listWorkConnections()); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'work_connections_unavailable'); }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const register = async (event: FormEvent) => {
    event.preventDefault();
    if (!provider.trim() || !externalRef.trim() || saving) return;
    setSaving(true); setError(null);
    try {
      await registerWorkConnectionRef({
        provider: provider.trim(),
        mechanism,
        externalRef: externalRef.trim(),
        capabilities: capabilities.split(',').map((value) => value.trim()).filter(Boolean)
      });
      setProvider(''); setExternalRef(''); setCapabilities('');
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'work_connection_register_failed');
    } finally { setSaving(false); }
  };

  const revoke = async (connectionId: string) => {
    if (saving) return;
    setSaving(true); setError(null);
    try { await revokeWorkConnectionRef(connectionId); await refresh(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'work_connection_revoke_failed'); }
    finally { setSaving(false); }
  };

  return (
    <section className="work-page page-stack">
      <header className="page-header"><p className="eyebrow">ATLAS Work Soberano</p><h1>Connections</h1><p>Register only opaque references created by an approved OAuth, browser-session or vault subsystem. Secrets are never displayed here.</p></header>
      <WorkSubnav />
      <form className="execution-panel work-config-grid" onSubmit={(event) => void register(event)}>
        <label><span>Provider</span><input value={provider} maxLength={80} onChange={(event) => setProvider(event.target.value)} placeholder="Provider identifier" required /></label>
        <label><span>Mechanism</span><select value={mechanism} onChange={(event) => setMechanism(event.target.value as WorkConnectionSummary['mechanism'])}><option value="oauth">OAuth</option><option value="session">Browser session</option><option value="vault">Vault</option></select></label>
        <label><span>Authorized reference</span><input type="password" autoComplete="off" value={externalRef} onChange={(event) => setExternalRef(event.target.value)} placeholder="Opaque external reference" required /></label>
        <label><span>Capabilities</span><input value={capabilities} onChange={(event) => setCapabilities(event.target.value)} placeholder="browser.navigate, provider.read" /></label>
        <button className="execution-action" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Register connection'}</button>
      </form>
      {error ? <div role="alert" className="work-error">{error}</div> : null}
      {connections === null && !error ? <p aria-busy="true">Loading connections…</p> : null}
      {connections?.length === 0 ? <div className="empty-state"><strong>No authorized Work connections are registered for this organization.</strong><span>Authorize a provider through its approved subsystem, then register its opaque reference here.</span></div> : null}
      {connections?.length ? <div className="work-card-grid">{connections.map((connection) => (
        <article className="execution-panel" key={connection.id}>
          <p className="eyebrow">{connection.mechanism}</p><h2>{connection.provider}</h2>
          <p>Status: <strong>{connection.status}</strong></p>
          <h3>Capabilities</h3>
          {connection.capabilities.length ? <ul>{connection.capabilities.map((capability) => <li key={capability}><code>{capability}</code></li>)}</ul> : <p>No capabilities are registered.</p>}
          {connection.status === 'active' ? <button type="button" className="execution-action" disabled={saving} onClick={() => void revoke(connection.id)}>Revoke</button> : null}
        </article>
      ))}</div> : null}
    </section>
  );
}
