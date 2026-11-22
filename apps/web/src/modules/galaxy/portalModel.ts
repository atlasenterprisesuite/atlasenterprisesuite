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


/** Search the canonical portal catalog without changing authorization/readiness. */
export function filterPortalDestinations(
  destinations: readonly PortalDestination[], query: string, area: string
): PortalDestination[] {
  if (query.length > 150) return [];
  const normalize = (value: string) => value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  return destinations.filter((destination) => {
    if (area !== 'All' && destination.area !== area) return false;
    const haystack = normalize([destination.id, destination.label, destination.title, destination.area, destination.description].join(' '));
    return terms.every((term) => haystack.includes(term));
  });
}

/** Resolve only against the current canonical view. Route guards remain authoritative. */
export function resolveDiscoveryRoute(destinations: readonly PortalDestination[], id: string): string | null {
  const matches = destinations.filter((destination) => destination.id === id);
  if (matches.length !== 1) return null;
  const destination = matches[0];
  if (!destination.navigable || destination.status === 'blocked' || !/^\/(?!\/)[a-zA-Z0-9/_-]*$/.test(destination.route)) return null;
  return destination.route;
}
