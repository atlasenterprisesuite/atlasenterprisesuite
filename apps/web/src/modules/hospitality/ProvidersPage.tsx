import { useEffect, useMemo, useState } from 'react';
import { getHospitalityReadiness, type HospitalityProvider, type HospitalityProviderState } from '../../lib/hospitalityApi';
import { HospitalitySubnav } from './HospitalitySubnav';

const stateLabels: Record<HospitalityProviderState, string> = {
  not_configured: 'Not configured',
  configured_unverified: 'Configured — verification required',
  ready: 'Ready',
  degraded: 'Degraded',
  offline: 'Offline',
  disabled: 'Disabled'
};

export function ProvidersPage() {
  const [providers, setProviders] = useState<HospitalityProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function refresh() {
    setLoading(true);
    setError('');
    try {
      const readiness = await getHospitalityReadiness();
      setProviders(readiness.providers || []);
    } catch (cause) {
      setProviders([]);
      setError(cause instanceof Error ? cause.message : 'Unable to load providers.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  const grouped = useMemo(() => {
    const groups = new Map<string, HospitalityProvider[]>();
    for (const provider of providers) {
      const key = provider.property_id || 'Unassigned property';
      groups.set(key, [...(groups.get(key) || []), provider]);
    }
    return [...groups.entries()];
  }, [providers]);

  return (
    <section className="page-stack hospitality-access">
      <header className="page-header">
        <p className="eyebrow">ATLAS Hospitality</p>
        <h1>Access Providers</h1>
        <p>Official provider readiness by hotel property. A configured integration is not treated as ready until its non-destructive verification succeeds.</p>
      </header>
      <HospitalitySubnav />

      <div className="hospitality-toolbar">
        <p>{loading ? 'Checking provider readiness…' : `${providers.length} provider instance${providers.length === 1 ? '' : 's'}`}</p>
        <button className="text-link" type="button" onClick={() => void refresh()} disabled={loading}>Refresh</button>
      </div>

      {error ? <div className="hospitality-message error" role="alert">{error}</div> : null}
      {!loading && !error && providers.length === 0 ? (
        <div className="feature-card wide hospitality-empty">
          <h2>No provider instances configured</h2>
          <p>ATLAS will not show a hotel lock system as connected until an authorized provider instance exists for that property.</p>
        </div>
      ) : null}

      {grouped.map(([propertyId, items]) => (
        <section key={propertyId} className="page-stack hospitality-provider-group">
          <div className="card-heading">
            <div><p className="eyebrow">Property</p><h2>{propertyId}</h2></div>
          </div>
          <div className="hospitality-status-grid">
            {items.map((provider) => (
              <article key={provider.id} className="feature-card hospitality-provider-card">
                <div className="hospitality-card-row">
                  <div>
                    <p className="eyebrow">{provider.provider_type}</p>
                    <h3>{provider.display_name}</h3>
                  </div>
                  <span className={`hospitality-state hospitality-state-${provider.state}`}>
                    {stateLabels[provider.state] || provider.state}
                  </span>
                </div>
                <dl className="hospitality-metadata">
                  <div><dt>Provider property</dt><dd>{provider.provider_property_id || 'Not assigned'}</dd></div>
                  <div><dt>Capabilities</dt><dd>{provider.capabilities?.length ? provider.capabilities.join(', ') : 'None verified'}</dd></div>
                  <div><dt>Last verification</dt><dd>{provider.checked_at || provider.last_verified_at || 'Never verified'}</dd></div>
                  <div><dt>Blocker</dt><dd>{provider.blocker || 'None reported'}</dd></div>
                </dl>
              </article>
            ))}
          </div>
        </section>
      ))}
    </section>
  );
}
