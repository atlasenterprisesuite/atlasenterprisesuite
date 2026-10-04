import React from 'react';
import { getPlanCatalog } from '../../services/atlas-max/catalog';

export function PlanComparison() {
  return (
    <section aria-labelledby="atlas-max-plans-title">
      <h2 id="atlas-max-plans-title">Plans</h2>
      <div className="module-grid">
        {getPlanCatalog().map((plan) => (
          <article
            key={plan.id}
            className={plan.id === 'max' ? 'module-card enabled accent' : 'module-card enabled'}
            data-testid={plan.id === 'max' ? 'atlas-max-plan' : undefined}
            aria-current={plan.id === 'max' ? 'true' : undefined}
          >
            <span>{plan.speedClasses.join(' · ')}</span>
            <strong>{plan.displayName}</strong>
            <p>{plan.capabilities.length ? plan.capabilities.join(' · ') : 'Essential governed intelligence'}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
