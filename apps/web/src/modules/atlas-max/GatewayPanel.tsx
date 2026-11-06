import React from 'react';
import type { AtlasMaxGatewaySnapshot } from './gatewaySnapshot';

export type AtlasMaxGatewayPanelState = AtlasMaxGatewaySnapshot | { state: 'loading' };

export function GatewayPanel({
  gateway,
  onRefresh
}: {
  gateway: AtlasMaxGatewayPanelState;
  onRefresh?: () => void;
}) {
  const ready = gateway.state === 'ready';
  return (
    <section className="atlas-max-gateway" aria-labelledby="atlas-max-gateway-title">
      <div className="atlas-max-section-heading">
        <div>
          <p className="atlas-max-kicker">04 / Authenticated infrastructure</p>
          <h2 id="atlas-max-gateway-title">Intelligence Gateway</h2>
        </div>
        <p>Read-only operational status from the existing ATLAS Copilot service. These readings do not establish a MAX subscription or an operator entitlement.</p>
      </div>
      <div className="atlas-max-gateway-grid" aria-live="polite">
        <div className="atlas-max-gateway-stat">
          <span className="atlas-max-field-label">Service evidence</span>
          <strong>{ready ? 'Authenticated snapshot' : gateway.state === 'loading' ? 'Checking service…' : 'Unavailable'}</strong>
          <p>{ready ? 'Scoped to your currently authorized organization.' : gateway.state === 'loading' ? 'Requesting status for the active organization.' : 'No verified readiness can be displayed at this time.'}</p>
        </div>
        <div className="atlas-max-gateway-stat">
          <span className="atlas-max-field-label">Verified providers</span>
          <strong>{ready ? gateway.verifiedProviders.length : '—'}</strong>
          {ready && gateway.verifiedProviders.length > 0
            ? <ul className="atlas-max-provider-list">{gateway.verifiedProviders.map((id) => <li key={id}>{id}</li>)}</ul>
            : <p>{ready ? 'No providers currently verified for this organization.' : 'No provider claims without an authenticated response.'}</p>}
        </div>
        <div className="atlas-max-gateway-stat">
          <span className="atlas-max-field-label">Assistant requests · 30 days</span>
          <strong>{ready && gateway.requests !== null ? gateway.requests.toLocaleString() : '—'}</strong>
          <p>{ready && gateway.requests !== null
            ? gateway.usageScope === 'actor' ? 'Authorized actor-scope history, not MAX quota.' : 'Organization-scope history, not MAX quota.'
            : 'Usage history unavailable or not verified.'}</p>
        </div>
      </div>
      <div className="atlas-max-gateway-footer">
        <span>{ready ? <>Retrieved <time dateTime={gateway.checkedAt}>{new Date(gateway.checkedAt).toLocaleString()}</time></> : 'Readiness is not cached as entitlement.'}</span>
        {onRefresh && <button type="button" className="atlas-max-refresh" onClick={onRefresh} disabled={gateway.state === 'loading'}>Refresh gateway evidence</button>}
      </div>
    </section>
  );
}
