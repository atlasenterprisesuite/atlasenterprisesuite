import React from 'react';

export function OperatorPanel() {
  return (
    <section className="feature-card" aria-labelledby="atlas-max-operators-title">
      <h2 id="atlas-max-operators-title">ATLAS Operators</h2>
      <p>Persistent operators require verified entitlement, explicit permissions, a budget ceiling, and runtime evidence.</p>
      <button type="button" disabled aria-disabled="true">Create operator</button>
    </section>
  );
}
