import { useParams } from 'react-router-dom';
import { healthModuleCatalog, type HealthModuleId } from '../../../../../packages/health/src';
import { HealthDataNotice } from './shared/HealthDataNotice';
import { HealthModuleCard } from './shared/HealthModuleCard';

export function HealthModulePortfolio() {
  return (
    <section className="page-stack health-page">
      <header className="page-header">
        <p className="eyebrow">ATLAS Health / Operations</p>
        <h1>Health Module Portfolio</h1>
        <p>All 18 approved Health domains share the same tenant, permission, audit, and source-state contracts.</p>
      </header>
      <HealthDataNotice state="demo" text="Module shells are navigable; each domain is expanded only through its governed implementation task." />
      <div className="module-grid health-module-grid">
        {healthModuleCatalog.map((module) => (
          <HealthModuleCard key={module.id} title={module.name} description={module.description} to={module.route} eyebrow="Health module" />
        ))}
      </div>
    </section>
  );
}

export function HealthModuleShell() {
  const { moduleId } = useParams<{ moduleId: HealthModuleId }>();
  const module = healthModuleCatalog.find((item) => item.id === moduleId);

  if (!module) {
    return (
      <section className="page-stack health-page">
        <header className="page-header"><p className="eyebrow">ATLAS Health</p><h1>Health module not found</h1><p>The requested module is not part of the approved Health catalog.</p></header>
      </section>
    );
  }

  return (
    <section className="page-stack health-page">
      <header className="page-header">
        <p className="eyebrow">ATLAS Health / Operations</p>
        <h1>{module.name}</h1>
        <p>{module.description}</p>
      </header>
      <HealthDataNotice state="demo" text="This governed module shell is active. Domain-specific workflows and integrations are enabled only when their implementation and authorization gates pass." />
    </section>
  );
}
