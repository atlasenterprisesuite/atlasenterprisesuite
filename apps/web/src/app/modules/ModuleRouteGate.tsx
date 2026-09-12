import type { ReactNode } from 'react';
import { useAtlasContext } from '../AtlasContext';
import { resolveAtlasModuleAvailability } from './moduleAvailability';
import { findAtlasModule } from './moduleCatalog';
import { ModuleGatewayPage } from './ModuleGatewayPage';
import { useAtlasModuleState } from './AtlasModuleState';

export function ModuleRouteGate({ moduleId, children }: { moduleId: string; children: ReactNode }) {
  const identity = useAtlasContext();
  const moduleState = useAtlasModuleState();
  const module = findAtlasModule(moduleId);

  if (!module || identity.status !== 'ready') return <>{children}</>;

  if (moduleState.status === 'loading') {
    return (
      <section className="module-gateway page-stack" aria-busy="true">
        <p className="eyebrow">{module.category}</p>
        <h1>{module.displayName}</h1>
        <div className="empty-state"><strong>Checking organization module access</strong></div>
      </section>
    );
  }

  if (moduleState.status === 'unavailable') {
    return <>{children}</>;
  }

  if (moduleState.status === 'error') {
    return <ModuleGatewayPage moduleId={moduleId} />;
  }

  const availability = resolveAtlasModuleAvailability(module, identity.permissions, moduleState.enabledModuleCodes);
  if (availability === 'available' || availability === 'partial') return <>{children}</>;

  return <ModuleGatewayPage moduleId={moduleId} />;
}
