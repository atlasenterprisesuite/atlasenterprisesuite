import { useState } from 'react';
import { Link } from 'react-router-dom';
import { evaluateTensor } from '../../../../../packages/health/jaque-mate/tensor';
import type { TensorEvaluation } from '../../../../../packages/health/jaque-mate/types';

const SIMULATION_WATERMARK = 'SIMULATION — NOT CLINICAL EVIDENCE' as const;
const LAB_ROOT = '/health/research/frontiers/disease-reconstruction';

interface TensorFormState {
  seed: number;
  state: number;
  niche: number;
  time: number;
}

const initialTensor: TensorFormState = {
  seed: 50,
  state: 50,
  niche: 50,
  time: 50
};

function TensorField({
  label,
  value,
  onChange
}: {
  label: keyof TensorFormState;
  value: number;
  onChange: (value: number) => void;
}) {
  const displayLabel = label.charAt(0).toUpperCase() + label.slice(1);
  return (
    <label className="field" htmlFor={`jaque-mate-${label}`}>
      <span>{displayLabel}</span>
      <input
        id={`jaque-mate-${label}`}
        type="number"
        min="0"
        max="100"
        step="1"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

export function JaqueMateSentinelPage() {
  const [tensor, setTensor] = useState<TensorFormState>(initialTensor);
  const [result, setResult] = useState<TensorEvaluation | null>(null);

  const updateDimension = (dimension: keyof TensorFormState, value: number) => {
    setTensor((current) => ({ ...current, [dimension]: value }));
  };

  const runEducationalSimulation = () => {
    const evaluation = evaluateTensor({
      ...tensor,
      evidence: {
        evidenceType: 'SIMULATION',
        simulationId: `educational-${Date.now()}`,
        watermark: SIMULATION_WATERMARK
      }
    });
    setResult(evaluation);
  };

  return (
    <div className="page-stack">
      <nav aria-label="Jaque Mate + Sentinel breadcrumb">
        <Link className="text-link" to={LAB_ROOT}>Disease Reconstruction Lab</Link>
        <span aria-hidden="true"> / </span>
        <span aria-current="page">Jaque Mate + Sentinel</span>
      </nav>

      <header className="page-header">
        <p className="eyebrow">ATLAS Health · Disease Reconstruction Lab</p>
        <h1>Jaque Mate + Sentinel</h1>
        <p>Seed × State × Niche × Time research modeling with persistent Sentinel controls and explicit evidence boundaries.</p>
      </header>

      <div className="notice strong" role="note">
        <strong>Research and simulation only.</strong> No automated clinical action is authorized or performed by this surface.
      </div>

      <section className="feature-card wide" aria-labelledby="evidence-boundary-heading">
        <p className="eyebrow">Evidence boundary</p>
        <h2 id="evidence-boundary-heading">Validated evidence, hypotheses and simulations remain isolated</h2>
        <div className="module-grid compact">
          <article className="module-card disabled" aria-disabled="true">
            <span>Validated evidence</span>
            <strong>Service-controlled ingestion</strong>
            <p>Requires explicit source provenance and confirmation. This educational surface cannot create validated clinical evidence.</p>
          </article>
          <article className="module-card disabled" aria-disabled="true">
            <span>Hypothesis</span>
            <strong>Research-only state</strong>
            <p>Hypotheses remain distinct from validated evidence and cannot be promoted by this simulation.</p>
          </article>
          <article className="module-card enabled">
            <span>Simulation</span>
            <strong>{SIMULATION_WATERMARK}</strong>
            <p>Educational output is permanently labeled as simulation and never authorizes treatment.</p>
          </article>
        </div>
      </section>

      <section className="feature-card wide" aria-labelledby="engines-heading">
        <p className="eyebrow">Sentinel engines</p>
        <h2 id="engines-heading">Governed research components</h2>
        <div className="module-grid compact">
          <article className="module-card enabled"><span>Tensor</span><strong>Seed × State × Niche × Time</strong><p>Normalizes four research dimensions without modifying the validated evidence layer.</p></article>
          <article className="module-card enabled"><span>Adaptive stability</span><strong>Sentinel Fitness</strong><p>Measures deviation against a declared tolerance without inferring a diagnosis.</p></article>
          <article className="module-card enabled"><span>Persistence</span><strong>Pathological Memory Depth</strong><p>Applies temporal decay so transient historical anomalies lose influence over time.</p></article>
          <article className="module-card enabled"><span>Governance</span><strong>Response-Gating</strong><p>Blocks insufficiently supported responses and can advance qualifying output only to human review.</p></article>
          <article className="module-card enabled"><span>Edge efficiency</span><strong>Surveillance Cost</strong><p>Reports compute and energy burden transparently for configured monitoring nodes.</p></article>
        </div>
      </section>

      <section className="feature-card wide" aria-labelledby="simulation-heading">
        <p className="eyebrow">Educational simulator</p>
        <h2 id="simulation-heading">Seed × State × Niche × Time</h2>
        <p>{SIMULATION_WATERMARK}</p>
        <div className="filter-row">
          {(Object.keys(tensor) as Array<keyof TensorFormState>).map((dimension) => (
            <TensorField
              key={dimension}
              label={dimension}
              value={tensor[dimension]}
              onChange={(value) => updateDimension(dimension, value)}
            />
          ))}
        </div>
        <button type="button" onClick={runEducationalSimulation}>Run educational simulation</button>
        {result ? (
          <div className="risk-panel" aria-live="polite">
            <div className="risk-score">
              <strong>Research score: {result.researchScore}</strong>
              <span>Evidence type: {result.evidenceType}</span>
            </div>
            <div className="notice">Clinical action allowed: no</div>
          </div>
        ) : (
          <div className="empty-state"><strong>No simulation run yet</strong><span>Choose research dimensions, then run the educational model.</span></div>
        )}
      </section>

      <section className="feature-card wide" aria-labelledby="config-heading">
        <p className="eyebrow">Sentinel configuration</p>
        <h2 id="config-heading">Production tuning remains unconfigured</h2>
        <dl>
          <div><dt>sentinel.fitness.threshold</dt><dd>Not configured</dd></div>
          <div><dt>sentinel.memory.pathological_depth</dt><dd>Not configured</dd></div>
          <div><dt>sentinel.cost.surveillance_rate</dt><dd>Not configured</dd></div>
        </dl>
        <p>No placeholder research value is treated as a production clinical threshold.</p>
      </section>
    </div>
  );
}
