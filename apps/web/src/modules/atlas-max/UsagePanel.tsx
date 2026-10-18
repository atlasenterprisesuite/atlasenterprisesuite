import React from 'react';

export function UsagePanel({ used, limit }: { used: number; limit: number }) {
  return (
    <section className="feature-card" aria-labelledby="atlas-max-usage-title">
      <h2 id="atlas-max-usage-title">Usage</h2>
      <p>{limit > 0 ? `${used} of ${limit} governed units used` : 'Usage limit unavailable'}</p>
    </section>
  );
}
