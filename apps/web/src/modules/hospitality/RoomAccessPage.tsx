import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getHospitalityReadiness,
  type HospitalityProvider,
  type HospitalityReadiness
} from '../../lib/hospitalityApi';
import { HospitalitySubnav } from './HospitalitySubnav';

export function RoomAccessPage() {
  const [readiness, setReadiness] = useState<HospitalityReadiness | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function refresh() {
    setLoading(true);
    setError('');
    try {
      setReadiness(await getHospitalityReadiness());
    } catch (cause) {
      setReadiness(null);
      setError(cause instanceof Error ? cause.message : 'Unable to load Hospitality readiness.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  const providers = readiness?.providers || [];
  const properties = useMemo(
    () => [...new Set(providers.map((provider: HospitalityProvider) => provider.property_id).filter(Boolean))],
    [providers]
  );
  const readyProviders = providers.filter((provider) => provider.state === 'ready');
  const blockedProviders = providers.filter((provider) => provider.state !== 'ready');
  const issuanceReady = readyProviders.filter((provider) => provider.capabilities?.includes('credential.issue'));

  return (
    <section className="page-stack hospitality-access">
      <header className="page-header">
        <p className="eyebrow">ATLAS Hospitality</p>
        <h1>Room Access</h1>
        <p>Governed hotel access orchestration across authorized providers. Readiness, room mappings, credential references, and audit evidence stay separated by organization and property.</p>
      </header>
      <HospitalitySubnav />

      <div className="hospitality-toolbar">
        <p>{loading ? 'Checking live readiness…' : `Checked ${readiness?.checked_at || 'not available'}`}</p>
        <button className="text-link" type="button" onClick={() => void refresh()} disabled={loading}>Refresh readiness</button>
      </div>

      {error ? <div className="hospitality-message error" role="alert">{error}</div> : null}

      <div className="hospitality-status-grid">
        <article className="feature-card">
          <p className="eyebrow">Identity boundary</p>
          <strong>{readiness?.organization_id ? 'Verified' : loading ? 'Checking…' : 'Unavailable'}</strong>
          <p>{readiness?.organization_id ? `Organization ${readiness.organization_id} · role ${readiness.role}` : 'An authenticated ATLAS organization is required.'}</p>
        </article>
        <article className="feature-card">
          <p className="eyebrow">Properties</p>
          <strong>{properties.length}</strong>
          <p>{properties.length ? 'Properties represented by configured provider instances.' : 'No authorized property provider instances are configured.'}</p>
        </article>
        <article className="feature-card">
          <p className="eyebrow">Credential issuance</p>
          <strong>{issuanceReady.length ? 'Ready' : 'Blocked'}</strong>
          <p>{issuanceReady.length ? `${issuanceReady.length} provider instance${issuanceReady.length === 1 ? '' : 's'} currently report verified issue capability.` : 'No provider currently reports both ready state and credential.issue capability.'}</p>
        </article>
      </div>

      <div className="hospitality-dashboard-grid">
        <Link to="/hospitality/access/providers" className="feature-card hospitality-dashboard-link">
          <p className="eyebrow">Providers</p>
          <h2>{providers.length}</h2>
          <p>{readyProviders.length} ready · {blockedProviders.length} blocked/degraded/offline</p>
        </Link>
        <Link to="/hospitality/access/rooms" className="feature-card hospitality-dashboard-link">
          <p className="eyebrow">Room mappings</p>
          <h2>Verify mappings</h2>
          <p>Credential issuance is denied unless the requested ATLAS room has a verified provider mapping.</p>
        </Link>
        <Link to="/hospitality/access/credentials" className="feature-card hospitality-dashboard-link">
          <p className="eyebrow">Credentials</p>
          <h2>Lifecycle</h2>
          <p>Issue and revoke external credential references through verified provider capabilities.</p>
        </Link>
        <Link to="/hospitality/access/audit" className="feature-card hospitality-dashboard-link">
          <p className="eyebrow">Audit</p>
          <h2>Evidence</h2>
          <p>Review property-scoped issue, revoke, failure, and reconciliation events when your permission allows it.</p>
        </Link>
      </div>

      {!loading && !error && providers.length === 0 ? (
        <div className="feature-card wide hospitality-empty">
          <h2>No provider instance is configured yet</h2>
          <p>ATLAS remains fail-closed. Add an authorized provider configuration server-side and verify it before room credential operations can become available.</p>
        </div>
      ) : null}

      {blockedProviders.length ? (
        <div className="feature-card wide">
          <div className="card-heading"><div><p className="eyebrow">Production blockers</p><h2>Provider readiness</h2></div><span>{blockedProviders.length}</span></div>
          <div className="hospitality-blocker-list">
            {blockedProviders.map((provider) => (
              <div key={provider.id} className="hospitality-blocker-row">
                <div><strong>{provider.display_name}</strong><small>{provider.property_id} · {provider.provider_type}</small></div>
                <span>{provider.blocker || provider.state}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
