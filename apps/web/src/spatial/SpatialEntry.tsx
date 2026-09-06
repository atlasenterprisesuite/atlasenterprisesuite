import { Link } from 'react-router-dom';
import { AtlasSpatialScene } from './AtlasSpatialScene';
import { useSpatialPreferences } from './useSpatialPreferences';
import './spatial.css';

export function SpatialEntry() {
  const { reducedMotion, webglSupported } = useSpatialPreferences();
  const showSpatialScene = webglSupported && !reducedMotion;

  return (
    <section className="spatial-entry" aria-labelledby="spatial-title">
      {showSpatialScene ? (
        <div className="spatial-canvas" aria-hidden="true">
          <AtlasSpatialScene reducedMotion={reducedMotion} />
        </div>
      ) : (
        <div className="spatial-fallback-orbit" aria-hidden="true" />
      )}

      <div className="spatial-grid" aria-hidden="true" />
      <div className="spatial-content">
        <p className="spatial-eyebrow">One governed ecosystem</p>
        <h1 id="spatial-title">ATLAS Enterprise Suite</h1>
        <p className="spatial-lede">Governed enterprise intelligence, connected by design.</p>
        <div className="spatial-actions">
          <Link className="spatial-primary-action" to="/health">Enter ATLAS Health</Link>
          <span className="spatial-environment-chip">Development foundation</span>
        </div>
        <p className="spatial-note">Generated in-browser. No prerecorded interface. No fabricated live connections.</p>
      </div>
    </section>
  );
}
