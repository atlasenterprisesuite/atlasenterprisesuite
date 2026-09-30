import {
  ATLAS_MODULES,
  type AtlasModuleDefinition,
  type AtlasModuleReadiness
} from '../registry';

export type PortalStatus = 'integrated' | 'partial' | 'pending-gate' | 'blocked';

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
      statusLabel: 'Blocked · identity gate pending',
      navigable: false
    };
  }

  if (module.readiness === 'implemented') {
    return {
      status: 'integrated',
      statusLabel: 'Integrated · production verification pending',
      navigable: true
    };
  }

  if (module.readiness === 'partial') {
    return {
      status: 'partial',
      statusLabel: 'Integrated / partial · production verification pending',
      navigable: true
    };
  }

  return {
    status: 'pending-gate',
    statusLabel: 'Pending external verification gate',
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
