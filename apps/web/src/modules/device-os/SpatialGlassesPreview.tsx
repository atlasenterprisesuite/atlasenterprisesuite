import { useState } from 'react';
import {
  SPATIAL_GLASSES_SCENES,
  resolveSpatialGlassesPreview,
  type SpatialGlassesSceneId
} from './spatialGlassesPreviewModel';
import './SpatialGlassesPreview.css';

/** Browser-only concept; no SDK, sensors, camera, AI provider, or tenant data. */
export function SpatialGlassesPreview() {
  const [selectedId, setSelectedId] = useState<SpatialGlassesSceneId>('workspace');
  const decision = resolveSpatialGlassesPreview(selectedId);
  if (decision.state !== 'simulation') return null;

  return (
    <section className="atlas-glasses-preview feature-card wide" aria-label="ATLAS Glasses browser simulation">
      <div className="atlas-glasses-preview-header">
        <div>
          <p className="eyebrow">ATLAS Spatial · Local concept</p>
          <h2>Glasses experience preview</h2>
          <p>Explore three illustrative panels. This is not SPECS, visionOS or a connected AR device.</p>
        </div>
        <span className="status-chip warning">SIMULATION ONLY</span>
      </div>
      <div className="atlas-glasses-preview-tabs" role="group" aria-label="Choose simulated scene">
        {SPATIAL_GLASSES_SCENES.map((scene) => (
          <button
            key={scene.id}
            type="button"
            aria-pressed={selectedId === scene.id}
            className={selectedId === scene.id ? 'atlas-glasses-preview-tab selected' : 'atlas-glasses-preview-tab'}
            onClick={() => setSelectedId(scene.id)}
          >{scene.label}</button>
        ))}
      </div>
      <div className="atlas-glasses-preview-stage" aria-live="polite" aria-atomic="true">
        <div className="atlas-glasses-preview-reticle" aria-hidden="true" />
        <div className="atlas-glasses-preview-hud">
          <span className="atlas-glasses-preview-kicker">LOCAL PREVIEW · NO LIVE DATA</span>
          <h3>{decision.scene.heading}</h3>
          <p>{decision.scene.description}</p>
          <ul>{decision.scene.indicators.map((item) => <li key={item}>{item}</li>)}</ul>
        </div>
      </div>
      <p className="atlas-glasses-preview-footnote">No camera, microphone, geolocation, hardware, remote requests or actions are used. Device integration requires independent authorization and verification.</p>
    </section>
  );
}
