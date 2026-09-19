import {
  ATLAS_MODULES,
  type AtlasModuleDefinition,
  type AtlasModuleReadiness
} from '../registry';

export type PortalStatus = 'active' | 'partial' | 'external-gated' | 'blocked';

export type PortalDestination = {
  id: string;
  label: string;
  title: string;
  area: string;
  route: string;
  readiness: AtlasModuleReadiness;
  status: PortalStatus;
  statusLabel: string;
  description: string;
  navigable: boolean;
};

function resolvePortalState(
  module: AtlasModuleDefinition,
  hasIdentity: boolean
): Pick<PortalDestination, 'status' | 'statusLabel' | 'navigable'> {
  if (module.requiresAuth && !hasIdentity) {
    return {
      status: 'blocked',
      statusLabel: 'Identity required',
      navigable: false
    };
  }

  if (module.readiness === 'implemented') {
    return {
      status: 'active',
      statusLabel: 'Implemented',
      navigable: true
    };
  }

  if (module.readiness === 'partial') {
    return {
      status: 'partial',
      statusLabel: 'Partial',
      navigable: true
    };
  }

  return {
    status: 'external-gated',
    statusLabel: 'External connection required',
    navigable: true
  };
}

export function buildPortalDestinations(input: {
  modules?: readonly AtlasModuleDefinition[];
  hasIdentity: boolean;
}): PortalDestination[] {
  const modules = input.modules ?? ATLAS_MODULES;

  return modules
    .filter((module) => module.id !== 'galaxy')
    .map((module) => ({
      id: module.id,
      label: module.navLabel,
      title: module.title,
      area: module.area,
      route: module.route,
      readiness: module.readiness,
      description: module.description,
      ...resolvePortalState(module, input.hasIdentity)
    }));
}
