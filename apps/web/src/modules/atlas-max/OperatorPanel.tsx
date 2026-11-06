import React from 'react';

export function OperatorPanel() {
  return (
    <section className="atlas-max-control-panel" aria-labelledby="atlas-max-operators-title">
      <div className="atlas-max-control-heading">
        <span className="atlas-max-control-icon" aria-hidden="true">◇</span>
        <span className="atlas-max-field-label">Governed automation</span>
      </div>
      <h3 id="atlas-max-operators-title">Operator control</h3>
      <p>Persistent operators require entitlement, scoped permissions, budgets and an execution runtime with verifiable evidence.</p>
      <div className="atlas-max-operator-requirements">
        <span>Identity</span>
        <span>Policy</span>
        <span>Evidence</span>
      </div>
      <a className="atlas-max-readiness-link" href="/execution/manager/readiness">
        Review execution readiness <span aria-hidden="true">↗</span>
      </a>
    </section>
  );
}
