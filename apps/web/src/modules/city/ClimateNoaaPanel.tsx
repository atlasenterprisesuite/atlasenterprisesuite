import React, { useMemo, useState, type FormEvent } from 'react';
import { readAtlasClimateNoaaAlerts, type AtlasClimateNoaaResponse } from './climateNoaaApi';
import type { UrbanTwinEntity } from './urbanTwinRepository';

/**
 * A user-initiated read-only NOAA view within the canonical Urban Twin workspace.
 * Never requests device geolocation or treats a partial result as safe conditions.
 */
export function ClimateNoaaPanel({ entities }: { entities: readonly UrbanTwinEntity[] }) {
  const sites = useMemo(() => entities.filter((entity) =>
    entity.verification_state === 'verified' && entity.lifecycle_state === 'active' &&
    entity.latitude !== null && Number.isFinite(entity.latitude) &&
    entity.longitude !== null && Number.isFinite(entity.longitude) &&
    Math.abs(entity.latitude) <= 90 && Math.abs(entity.longitude) <= 180
  ), [entities]);

  const [selectedId, setSelectedId] = useState('');
  const [requestState, setRequestState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [failure, setFailure] = useState('');
  const [answer, setAnswer] = useState<{ entityId: string; response: AtlasClimateNoaaResponse } | null>(null);
  const selected = sites.find((site) => site.id === selectedId) ?? null;
  const result = answer && selected && answer.entityId === selected.id ? answer.response : null;
  const isLoading = requestState === 'loading';

  async function checkAlerts(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || isLoading) return;
    const entityId = selected.id;
    setRequestState('loading');
    setFailure('');
    setAnswer(null);
    try {
      const response = await readAtlasClimateNoaaAlerts(entityId);
      if (response.mayPublishAlert !== false || !['complete', 'partial'].includes(response.status)) {
        throw new Error('invalid_climate_provider_response');
      }
      setAnswer({ entityId, response });
      setRequestState('ready');
    } catch {
      setRequestState('error');
      setFailure('Unable to check the NOAA feed. This is not evidence that there are no alerts. Check the official NWS website.');
    }
  }

  return (
    <section className="urban-twin-card urban-twin-climate" aria-labelledby="atlas-climate-heading">
      <div className="urban-twin-heading">
        <div>
          <p className="eyebrow">ATLAS Climate Resilience 777 · Read-only NOAA evidence</p>
          <h2 id="atlas-climate-heading">Check active NWS alerts for a verified site</h2>
        </div>
        <span>Manual lookup · No background tracking</span>
      </div>
      <p className="urban-twin-climate-intro">
        Select a verified Urban Twin location and explicitly request the NOAA feed. This
        does not access device geolocation, send notifications, or publish emergency warnings.
        ATLAS validates the site and its coordinates on the server, then shares the site's coordinates with NOAA for this lookup.
      </p>

      <form className="urban-twin-climate-form" onSubmit={(event) => { void checkAlerts(event); }}>
        <label htmlFor="atlas-climate-site">Site to check</label>
        <div className="urban-twin-climate-form-row">
          <select
            id="atlas-climate-site"
            value={selectedId}
            disabled={isLoading || sites.length === 0}
            onChange={(event) => {
              setSelectedId(event.target.value);
              setRequestState('idle');
              setFailure('');
              setAnswer(null);
            }}
          >
            <option value="">Select a verified location</option>
            {sites.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}
          </select>
          <button type="submit" disabled={!selected || isLoading}>
            {isLoading ? 'Checking NOAA…' : 'Consult NOAA'}
          </button>
        </div>
      </form>

      {sites.length === 0 ? (
        <p className="urban-twin-climate-note">No verified Urban Twin locations with coordinates are available. Register and verify a site before requesting its NOAA evidence.</p>
      ) : null}
      <p className="urban-twin-climate-note">
        Informational reference only. For official alerts, guidance and immediate safety decisions,
        consult the <a href="https://www.weather.gov/" target="_blank" rel="noopener noreferrer">National Weather Service</a>.
      </p>
      {isLoading ? <p role="status" className="urban-twin-climate-note">Checking the provider…</p> : null}
      {requestState === 'error' ? <p role="alert" className="urban-twin-climate-error">{failure}</p> : null}

      {requestState === 'ready' && result ? (
        <div className="urban-twin-climate-results" role="status" aria-live="polite">
          <strong>NOAA/NWS · Retrieved {new Date(result.fetchedAt).toLocaleString()}</strong>
          <span>Source: {result.source} · Evidence is reviewable, not an ATLAS emergency broadcast.</span>
          {result.status === 'partial' ? (
            <p className="urban-twin-climate-error">
              Incomplete NOAA result: {result.rejectedCount} rejected and {result.unprocessedCount} unprocessed records.
              A partial response cannot establish that conditions are clear.
            </p>
          ) : null}
          {result.status === 'complete' && result.providerCount === 0 ? (
            <p>No active NWS alerts were returned for this point. This is not proof that an area is safe.</p>
          ) : null}
          {result.alerts.length > 0 ? (
            <ul className="urban-twin-climate-alerts">
              {result.alerts.map((alert) => (
                <li key={alert.id}>
                  <strong>{alert.event}</strong>
                  <span>{alert.headline || 'Official weather alert record'}</span>
                  <small>Severity: {alert.severity || 'not provided'} · Expires: {new Date(alert.validUntil).toLocaleString()}</small>
                  <small>Evidence: reviewable only · NOAA record {alert.source.recordId}</small>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
