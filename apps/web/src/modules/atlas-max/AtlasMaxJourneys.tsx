import React, { useState } from 'react';

const JOURNEYS = [
  {
    id: 'finance',
    title: 'Finance operations',
    audience: 'For financial and operations teams',
    description: 'Explore how an organization can move from business records to reviews, decisions and traceable actions within ATLAS Finance.',
    steps: ['Choose organization context', 'Inspect authorized finance records', 'Review operational exceptions', 'Follow the approval boundary'],
    route: '/finance',
    action: 'Open Finance workspace'
  },
  {
    id: 'studio',
    title: 'Creative production',
    audience: 'For marketing and creative teams',
    description: 'Explore the existing creative workspace while preserving source ownership, review and explicit publication approval.',
    steps: ['Enter Studio workspace', 'Select an authorized project', 'Prepare and review an asset', 'Keep publication approval separate'],
    route: '/studio',
    action: 'Open ATLAS Studio'
  },
  {
    id: 'governance',
    title: 'Governed execution',
    audience: 'For IT and enterprise leaders',
    description: 'Inspect the readiness path that must be satisfied before delegated work can be treated as executable.',
    steps: ['Define execution scope', 'Check identity and policy', 'Inspect readiness and evidence', 'Authorize only permitted operations'],
    route: '/execution/manager/readiness',
    action: 'Review execution readiness'
  }
] as const;

export function AtlasMaxJourneys() {
  const [selected, setSelected] = useState<(typeof JOURNEYS)[number]['id']>('finance');
  const current = JOURNEYS.find((item) => item.id === selected) ?? JOURNEYS[0];

  return (
    <section className="atlas-max-journeys" aria-labelledby="atlas-max-journeys-title">
      <div className="atlas-max-section-heading">
        <div>
          <p className="atlas-max-kicker">02 / Explore real workspaces</p>
          <h2 id="atlas-max-journeys-title">Show the workflow, not just a feature list.</h2>
        </div>
        <p>Choose a product journey. The steps explain the intended sequence; the action opens an existing ATLAS route. Nothing is executed from this preview.</p>
      </div>
      <div className="atlas-max-journeys-layout">
        <div className="atlas-max-journey-options" aria-label="Select a workflow">
          {JOURNEYS.map((journey, index) => (
            <button
              key={journey.id}
              type="button"
              aria-pressed={selected === journey.id}
              onClick={() => setSelected(journey.id)}
              className={selected === journey.id ? 'atlas-max-journey-option selected' : 'atlas-max-journey-option'}
            >
              <span className="atlas-max-journey-number">0{index + 1}</span>
              <span className="atlas-max-journey-option-copy">
                <strong>{journey.title}</strong>
                <small>{journey.audience}</small>
              </span>
              <span aria-hidden="true">↗</span>
            </button>
          ))}
        </div>
        <div className="atlas-max-journey-detail" aria-live="polite">
          <span className="atlas-max-field-label">Selected journey · guided preview</span>
          <h3>{current.title}</h3>
          <p>{current.description}</p>
          <ol className="atlas-max-journey-steps">
            {current.steps.map((step, index) => (
              <li key={step}>
                <span className="atlas-max-step-number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
          <a className="atlas-max-link-primary" href={current.route}>{current.action} <span aria-hidden="true">↗</span></a>
          <p className="atlas-max-meta-note">Route availability and actions depend on the signed-in organization and its permissions.</p>
        </div>
      </div>
    </section>
  );
}
