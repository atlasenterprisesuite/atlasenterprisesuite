import { useMemo, useState } from 'react';
import {
  ATLAS_BOOT_PIPELINE,
  ATLAS_HARDWARE_CONCEPTS,
  ATLAS_RECOVERY_PIPELINE,
  classifyAdaptiveProfile
} from './deviceEvolutionModel';

function statusLabel(status: (typeof ATLAS_HARDWARE_CONCEPTS)[number]['status']) {
  if (status === 'software-surface') return 'Software surface defined';
  if (status === 'prototype-required') return 'Physical prototype required';
  return 'Research track';
}

export function DeviceEvolutionPanel() {
  const [memoryGb, setMemoryGb] = useState(4);
  const [logicalCores, setLogicalCores] = useState(4);
  const [localAiCapable, setLocalAiCapable] = useState(false);

  const adaptiveProfile = useMemo(
    () => classifyAdaptiveProfile({ memoryGb, logicalCores, localAiCapable }),
    [memoryGb, logicalCores, localAiCapable]
  );

  return (
    <section className="page-stack" aria-labelledby="device-evolution-title">
      <article className="feature-card wide">
        <div className="card-heading">
          <div>
            <p className="eyebrow">ATLAS Device DNA</p>
            <h2 id="device-evolution-title">Diagnose first. Adapt second. Boot truthfully.</h2>
          </div>
          <span className="status-chip warning">Hardware remains gated</span>
        </div>
        <p>
          This is the approved ATLAS hardware direction. The web module models the architecture and
          software control surface; it does not claim firmware, sensors, radios or recovery hardware
          are connected until signed native adapters provide evidence.
        </p>

        <div className="module-grid compact" aria-label="ATLAS normal boot pipeline">
          {ATLAS_BOOT_PIPELINE.map((step, index) => (
            <div className="module-card" key={step}>
              <span>Stage {index + 1}</span>
              <strong>{step}</strong>
            </div>
          ))}
        </div>
      </article>

      <article className="feature-card wide">
        <div className="card-heading">
          <div>
            <p className="eyebrow">ATLAS Phoenix</p>
            <h2>Independent recovery path</h2>
          </div>
          <span className="status-chip neutral">Architecture</span>
        </div>
        <div className="module-grid compact" aria-label="ATLAS recovery pipeline">
          {ATLAS_RECOVERY_PIPELINE.map((step, index) => (
            <div className="module-card" key={step}>
              <span>Recovery {index + 1}</span>
              <strong>{step}</strong>
            </div>
          ))}
        </div>
      </article>

      <article className="feature-card wide">
        <div className="card-heading">
          <div>
            <p className="eyebrow">Adaptive Computing</p>
            <h2>Estimate the runtime profile without pretending the browser can read firmware</h2>
          </div>
          <span className="status-chip neutral">Local estimator</span>
        </div>

        <div className="module-grid compact">
          <label className="module-card">
            <span>Memory</span>
            <strong>{memoryGb} GB RAM</strong>
            <input
              aria-label="Memory in gigabytes"
              type="range"
              min="2"
              max="64"
              step="2"
              value={memoryGb}
              onChange={(event) => setMemoryGb(Number(event.target.value))}
            />
          </label>
          <label className="module-card">
            <span>CPU</span>
            <strong>{logicalCores} logical cores</strong>
            <input
              aria-label="Logical CPU cores"
              type="range"
              min="1"
              max="32"
              value={logicalCores}
              onChange={(event) => setLogicalCores(Number(event.target.value))}
            />
          </label>
          <label className="module-card">
            <span>Local AI accelerator</span>
            <strong>{localAiCapable ? 'Available' : 'Not declared'}</strong>
            <input
              aria-label="Local AI accelerator available"
              type="checkbox"
              checked={localAiCapable}
              onChange={(event) => setLocalAiCapable(event.target.checked)}
            />
          </label>
          <div className="module-card enabled">
            <span>Recommended profile</span>
            <strong>ATLAS {adaptiveProfile.toUpperCase()}</strong>
            <p>This estimate uses only the values entered here. It is not live device telemetry.</p>
          </div>
        </div>
      </article>

      <div className="module-grid compact" aria-label="ATLAS future hardware concepts">
        {ATLAS_HARDWARE_CONCEPTS.map((concept) => (
          <article className="module-card" key={concept.id}>
            <span>{concept.category}</span>
            <strong>{concept.name}</strong>
            <p>{concept.purpose}</p>
            <span className={concept.status === 'software-surface' ? 'status-chip' : 'status-chip warning'}>
              {statusLabel(concept.status)}
            </span>
            <p>{concept.dependency}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
