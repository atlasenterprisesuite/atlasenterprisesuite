import { Link } from 'react-router-dom';
import { ATLAS_MODULE_CATALOG } from '../../app/modules/moduleCatalog';

export function EnterpriseHome() {
  return (
    <section className="enterprise-home page-stack">
      <header className="page-header enterprise-home__header">
        <p className="eyebrow">ATLAS Enterprise Suite</p>
        <h1>ATLAS Enterprise Suite</h1>
        <p>One governed workspace for people, finance, operations, intelligence, security, health, mobility and connected services.</p>
      </header>

      <div className="enterprise-module-grid" aria-label="ATLAS product modules">
        {ATLAS_MODULE_CATALOG.map((module) => (
          <Link
            key={module.id}
            to={module.route}
            className={`enterprise-module-card enterprise-module-card--${module.implementationState}`}
          >
            <span className="enterprise-module-card__category">{module.category}</span>
            <strong>{module.displayName}</strong>
            <p>{module.description}</p>
            <small>{module.implementationState.replaceAll('_', ' ')}</small>
          </Link>
        ))}
      </div>
    </section>
  );
}
