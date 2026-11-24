import React from 'react';

export function UsagePanel({ used, limit, evidenceRef }: { used: number; limit: number; evidenceRef?: string }) {
  const hasVerifiedMeter = Boolean(evidenceRef?.trim())
    && Number.isFinite(used) && Number.isFinite(limit)
    && limit > 0 && used >= 0 && used <= limit;

  return (
    <section className="atlas-max-control-panel" aria-labelledby="atlas-max-usage-title">
      <div className="atlas-max-control-heading">
        <span className="atlas-max-control-icon" aria-hidden="true">◈</span>
        <span className="atlas-max-field-label">Usage governor</span>
      </div>
      <h3 id="atlas-max-usage-title">Measured capacity</h3>
      {hasVerifiedMeter ? (
        <>
          <p className="atlas-max-usage-amount"><strong>{used.toLocaleString()}</strong> / {limit.toLocaleString()} governed units</p>
          <progress value={used} max={limit} aria-label="Governed usage" />
          <p className="atlas-max-meta-note">Measured usage supplied with a source reference.</p>
        </>
      ) : (
        <>
          <p className="atlas-max-usage-unavailable">Usage data unavailable</p>
          <p className="atlas-max-meta-note">No capacity, cost, or consumption is inferred until authenticated metering is connected.</p>
        </>
      )}
    </section>
  );
}
