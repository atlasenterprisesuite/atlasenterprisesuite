import React from 'react';
import { getPlanCatalog } from '../../services/atlas-max/catalog';
import type { AtlasCapability } from '../../services/atlas-max/contracts';

const CAPABILITY_LABELS: Record<AtlasCapability, string> = {
  'advanced-models': 'Advanced model access',
  'priority-execution': 'Priority execution class',
  'persistent-operators': 'Persistent governed operators',
  'expanded-memory': 'Expanded contextual memory',
  'expanded-storage': 'Expanded file and storage policy'
};

export function PlanComparison() {
  return (
    <section className="atlas-max-comparison" aria-labelledby="atlas-max-plans-title">
      <div className="atlas-max-section-heading">
        <div>
          <p className="atlas-max-kicker">02 / Capability catalog</p>
          <h2 id="atlas-max-plans-title">Capacity shaped around the work.</h2>
        </div>
        <p>Compare product definitions, not active subscriptions. Actual capacity requires server-verified entitlement and metering.</p>
      </div>
      <div className="atlas-max-tier-grid">
        {getPlanCatalog().map((plan) => (
          <article
            key={plan.id}
            className={plan.id === 'max' ? 'atlas-max-tier atlas-max-tier-featured' : 'atlas-max-tier'}
            data-testid={plan.id === 'max' ? 'atlas-max-plan' : undefined}
            data-featured={plan.id === 'max' ? 'true' : undefined}
          >
            <div className="atlas-max-tier-upper">
              <p className="atlas-max-tier-eyebrow">{plan.id === 'max' ? 'Highest design tier' : plan.id === 'pro' ? 'Expanded design tier' : 'Foundation tier'}</p>
              <h3>{plan.displayName}</h3>
              <p className="atlas-max-tier-description">{plan.id === 'max' ? 'Advanced orchestration and governed enterprise capacity.' : plan.id === 'pro' ? 'More intelligent work with expanded capabilities.' : 'Essential ATLAS intelligence and platform controls.'}</p>
            </div>
            <div className="atlas-max-tier-speed">
              <span>Declared speed classes</span>
              <strong>{plan.speedClasses.join(' / ').toUpperCase()}</strong>
            </div>
            <ul className="atlas-max-tier-features">
              {plan.capabilities.length === 0
                ? <li>Essential governed intelligence</li>
                : plan.capabilities.map((capability) => <li key={capability}>{CAPABILITY_LABELS[capability]}</li>)}
            </ul>
            <p className="atlas-max-tier-foot">Catalog definition · Availability subject to verification</p>
          </article>
        ))}
      </div>
    </section>
  );
}
