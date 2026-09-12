import { Link } from 'react-router-dom';
import { useAtlasContext } from '../AtlasContext';
import { resolveAtlasModuleAvailability, type AtlasModuleAvailability } from './moduleAvailability';
import { findAtlasModule } from './moduleCatalog';
import { useAtlasModuleState } from './AtlasModuleState';
import './moduleWorkspace.css';

const workbenchActions = [
  { to: '/release', label: 'Release Controller' },
  { to: '/automations', label: 'Automations' },
  { to: '/site-review', label: 'Site Review' },
  { to: '/spatial', label: 'Spatial' },
  { to: '/telecom/devices/mifi', label: 'Telecom device control' },
] as const;

const analyticsActions = [
  { to: '/finance/accounting', label: 'Accounting analytics source' },
  { to: '/operations', label: 'Revenue operations source' },
] as const;

function stateLabel(state: AtlasModuleAvailability) {
  switch (state) {
    case 'available': return 'Implemented and enabled for this organization';
    case 'partial': return 'Partial implementation — verified actions only';
    case 'blocked': return 'Blocked by an unverified provider or configuration dependency';
    case 'configuration_required': return 'Configuration required before activation';
    case 'not_enabled': return 'Not enabled for this organization';
    case 'unauthorized': return 'Your current role does not grant this module permission';
    case 'organization_state_unknown': return 'Organization module state has not been verified';
  }
}

export function ModuleGatewayPage({ moduleId }: { moduleId: string }) {
  const module = findAtlasModule(moduleId);
  const identity = useAtlasContext();
  const moduleState = useAtlasModuleState();

  if (!module) {
    return <section className="module-gateway"><h1>Module not registered</h1></section>;
  }

  const availability = resolveAtlasModuleAvailability(
    module,
    identity.status === 'ready' ? identity.permissions : [],
    moduleState.status === 'ready' ? moduleState.enabledModuleCodes : undefined,
  );
  const mayOpenActions = availability === 'available' || availability === 'partial';

  const candidateActions = module.id === 'workbench'
    ? workbenchActions
    : module.id === 'analytics'
      ? analyticsActions
      : module.legacyRoute
        ? [{ to: module.legacyRoute, label: `Open ${module.displayName}` }]
        : [];
  const actions = mayOpenActions ? candidateActions : [];

  return (
    <section className="module-gateway page-stack">
      <header className="page-header">
        <p className="eyebrow">{module.category}</p>
        <h1>{module.displayName}</h1>
        <p>{module.description}</p>
      </header>

      <div className={`module-state module-state--${availability}`}>
        <strong>{stateLabel(availability)}</strong>
        <span>ATLAS does not mark this capability live or connected without permission, organization and runtime evidence.</span>
      </div>

      {moduleState.status === 'error' ? (
        <div className="empty-state" role="status">
          <strong>Module state could not be verified</strong>
          <span>{moduleState.message}</span>
        </div>
      ) : null}

      {module.id === 'identity' && identity.status === 'ready' ? (
        <article className="feature-card wide">
          <p className="eyebrow">Authenticated scope</p>
          <h2>{identity.organizationName}</h2>
          <p>{identity.userEmail || identity.userId}</p>
          <p>Role: <strong>{identity.role}</strong></p>
        </article>
      ) : null}

      {actions.length > 0 ? (
        <div className="module-grid compact" aria-label={`${module.displayName} available actions`}>
          {actions.map((action) => (
            <Link className="module-card enabled" to={action.to} key={action.to}>
              <span>Verified route</span>
              <strong>{action.label}</strong>
              <p>Open the existing ATLAS capability without creating a parallel implementation.</p>
            </Link>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <strong>No authorized verified action is exposed</strong>
          <span>The module remains registered while its permission, organization, provider or implementation gates are completed.</span>
        </div>
      )}
    </section>
  );
}
