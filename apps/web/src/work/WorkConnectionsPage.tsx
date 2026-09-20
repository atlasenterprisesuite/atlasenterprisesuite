import { useEffect, useState, type FormEvent } from 'react';
import {
  listWorkConnections,
  registerWorkConnectionRef,
  revokeWorkConnectionRef,
  type WorkConnectionSummary
} from './api';
import { WorkSubnav } from './WorkSubnav';

function capabilityList(value: string) {
  return [...new Set(value.split(',').map((item) => item.trim()).filter(Boolean))].slice(0, 40);
}

export function WorkConnectionsPage() {
  const [connections, setConnections] = useState<WorkConnectionSummary[] | null>(null);
  const [provider, setProvider] = useState('');
  const [mechanism, setMechanism] = useState<WorkConnectionSummary['mechanism']>('oauth');
  const [externalRef, setExternalRef] = useState('');
  const [capabilities, setCapabilities] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadConnections = async () => {
    const rows = await listWorkConnections();
    setConnections(rows);
  };

  useEffect(() => {
    let active = true;
    void listWorkConnections()
      .then((rows) => { if (active) setConnections(rows); })
      .catch((caught) => { if (active) setError(caught instanceof Error ? caught.message : 'work_connections_unavailable'); });
    return () => { active = false; };
  }, []);

  const register = async (event: FormEvent) => {
    event.preventDefault();
    if (!provider.trim() || !externalRef.trim() || busyId) return;
    setBusyId('register');
    setError(null);
    setSuccess(null);
    try {
      await registerWorkConnectionRef({
        provider: provider.trim().toLowerCase(),
        mechanism,
        externalRef: externalRef.trim(),
        capabilities: capabilityList(capabilities)
      });
      setProvider('');
      setExternalRef('');
      setCapabilities('');
      await loadConnections();
      setSuccess('Connection reference registered for this organization.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'work_connection_register_failed');
    } finally {
      setBusyId(null);
    }
  };

  const revoke = async (connectionId: string) => {
    if (busyId) return;
    setBusyId(connectionId);
    setError(null);
    setSuccess(null);
    try {
      await revokeWorkConnectionRef(connectionId);
      await loadConnections();
      setSuccess('Connection reference revoked.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'work_connection_revoke_failed');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="work-page page-stack">
      <header className="page-header"><p className="eyebrow">ATLAS Work Soberano</p><h1>Connections</h1><p>Authorized provider, browser-session and vault references available to the active organization.</p></header>
      <WorkSubnav />

      <form className="execution-panel work-composer" onSubmit={(event) => void register(event)}>
        <h2>Register authorized connection</h2>
        <p className="notice">Register only an opaque reference created by an approved provider/session/vault subsystem. Never paste tokens, passwords, cookies, recovery codes or secret values here.</p>
        <div className="work-config-grid">
          <label>
            <span>Provider</span>
            <input aria-label="Provider" value={provider} maxLength={100} onChange={(event) => setProvider(event.target.value)} placeholder="cloudflare" required />
          </label>
          <label>
            <span>Mechanism</span>
            <select aria-label="Mechanism" value={mechanism} onChange={(event) => setMechanism(event.target.value as WorkConnectionSummary['mechanism'])}>
              <option value="oauth">OAuth / provider connection</option>
              <option value="session">Authorized session</option>
              <option value="vault">Secure vault reference</option>
            </select>
          </label>
          <label>
            <span>Connection reference</span>
            <input aria-label="Connection reference" value={externalRef} maxLength={500} onChange={(event) => setExternalRef(event.target.value)} placeholder="opaque-provider-reference" required />
          </label>
          <label>
            <span>Capabilities</span>
            <input aria-label="Capabilities" value={capabilities} onChange={(event) => setCapabilities(event.target.value)} placeholder="dns.read, dns.write.txt" />
          </label>
        </div>
        <div className="work-actions">
          <button className="execution-action" type="submit" disabled={busyId !== null || !provider.trim() || !externalRef.trim()}>
            {busyId === 'register' ? 'Registering…' : 'Register connection'}
          </button>
        </div>
      </form>

      {error ? <div role="alert" className="work-error">{error}</div> : null}
      {success ? <p role="status" className="notice">{success}</p> : null}
      {connections === null && !error ? <p aria-busy="true">Loading connections…</p> : null}
      {connections?.length === 0 ? <div className="empty-state"><strong>No authorized Work connections are registered for this organization.</strong><span>Register an opaque reference only after the provider has been authorized through its approved subsystem.</span></div> : null}
      {connections?.length ? <div className="work-card-grid">{connections.map((connection) => (
        <article className="execution-panel" key={connection.id}>
          <p className="eyebrow">{connection.mechanism}</p>
          <h2>{connection.provider}</h2>
          <p>Status: <strong>{connection.status}</strong></p>
          <h3>Capabilities</h3>
          {connection.capabilities.length ? <ul>{connection.capabilities.map((capability) => <li key={capability}><code>{capability}</code></li>)}</ul> : <p>No capabilities are registered.</p>}
          {connection.status === 'active' ? (
            <button className="execution-action" type="button" disabled={busyId !== null} onClick={() => void revoke(connection.id)}>
              {busyId === connection.id ? 'Revoking…' : 'Revoke connection'}
            </button>
          ) : null}
        </article>
      ))}</div> : null}
    </section>
  );
}
