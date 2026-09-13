import { Link } from 'react-router-dom';
import { blueprintCatalog } from './blueprintCatalog';
import './blueprints.css';

export function BlueprintsPage() {
  return (
    <section className="page-stack blueprints-page">
      <header className="page-header">
        <p className="eyebrow">ATLAS Product System</p>
        <h1>Blueprints</h1>
        <p>Approved visual specifications from ATLAS Library, reused as canonical implementation references instead of regenerated assets.</p>
      </header>

      <div className="blueprint-policy" role="note">
        <strong>Library first.</strong>
        <span>Reuse an approved reference before creating a new visual asset.</span>
      </div>

      <div className="blueprint-grid">
        {blueprintCatalog.map((blueprint) => (
          <article className="blueprint-card" key={blueprint.id}>
            <div className="blueprint-card__heading">
              <span>{blueprint.domain}</span>
              <span className={`status-chip status-${blueprint.implementationStatus}`}>{blueprint.implementationStatus}</span>
            </div>
            <h2>{blueprint.title}</h2>
            <p>{blueprint.sourceLabel}</p>
            <dl>
              <div><dt>Source</dt><dd>ATLAS Library</dd></div>
              <div><dt>Status</dt><dd>{blueprint.implementationStatus}</dd></div>
            </dl>
            <div className="blueprint-actions">
              {blueprint.moduleRoute ? (
                <Link className="action-link" to={blueprint.moduleRoute}>Open module</Link>
              ) : (
                <span className="action-disabled" aria-disabled="true">Module not active</span>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
