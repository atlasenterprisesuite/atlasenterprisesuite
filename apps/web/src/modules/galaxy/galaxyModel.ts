import {
  ATLAS_MODULES,
  type AtlasModuleDefinition
} from '../registry';

export type GalaxyCategory = 'core' | 'financial' | 'operations' | 'security';
export type GalaxyNodeStatus = 'active' | 'available' | 'blocked' | 'warning' | 'executing' | 'unverified';

export type GalaxyNodeDefinition = {
  id: string;
  label: string;
  category: GalaxyCategory;
  coordinates: { x: number; y: number };
  dependencies: string[];
  moduleId?: string;
  route?: string;
};

export type GalaxyNodeView = Omit<GalaxyNodeDefinition, 'route'> & {
  route: string | null;
  status: GalaxyNodeStatus;
  statusLabel: string;
  navigable: boolean;
};

export const GALAXY_NODE_DEFINITIONS: readonly GalaxyNodeDefinition[] = [
  {
    id: 'core',
    label: 'ATLAS Core Intelligence',
    category: 'core',
    coordinates: { x: 50, y: 50 },
    dependencies: ['finance', 'crm', 'security'],
    route: '/'
  },
  {
    id: 'finance',
    label: 'Capital Galaxy',
    category: 'financial',
    coordinates: { x: 30, y: 35 },
    dependencies: ['accounting'],
    moduleId: 'finance'
  },
  {
    id: 'accounting',
    label: 'Ledger Constellation',
    category: 'financial',
    coordinates: { x: 15, y: 25 },
    dependencies: [],
    route: '/finance/accounting'
  },
  {
    id: 'crm',
    label: 'Relationship Constellation',
    category: 'operations',
    coordinates: { x: 70, y: 35 },
    dependencies: ['core'],
    moduleId: 'crm'
  },
  {
    id: 'security',
    label: 'Zero-Trust Shield Grid',
    category: 'security',
    coordinates: { x: 50, y: 20 },
    dependencies: [],
    moduleId: 'execution'
  },
  {
    id: 'payroll',
    label: 'People Pay Network',
    category: 'operations',
    coordinates: { x: 75, y: 65 },
    dependencies: ['finance'],
    moduleId: 'payroll'
  },
  {
    id: 'inventory',
    label: 'Supply Network',
    category: 'operations',
    coordinates: { x: 25, y: 70 },
    dependencies: [],
    moduleId: 'inventory'
  }
] as const;

function readinessState(module: AtlasModuleDefinition): Pick<GalaxyNodeView, 'status' | 'statusLabel'> {
  if (module.readiness === 'implemented') {
    return { status: 'active', statusLabel: 'Implemented' };
  }
  if (module.readiness === 'partial') {
    return { status: 'warning', statusLabel: 'Partial' };
  }
  return { status: 'available', statusLabel: 'External connection required' };
}

export function buildGalaxyNodes(input: {
  modules?: readonly AtlasModuleDefinition[];
  hasIdentity: boolean;
}): GalaxyNodeView[] {
  const modules = input.modules ?? ATLAS_MODULES;
  const modulesById = new Map(modules.map((module) => [module.id, module]));

  return GALAXY_NODE_DEFINITIONS.map((definition) => {
    const module = definition.moduleId ? modulesById.get(definition.moduleId) : undefined;
    const route = module?.route ?? definition.route ?? null;

    if (module) {
      if (module.requiresAuth && !input.hasIdentity) {
        return {
          ...definition,
          route,
          status: 'blocked',
          statusLabel: 'Identity required',
          navigable: false
        };
      }

      const readiness = readinessState(module);
      return {
        ...definition,
        route,
        ...readiness,
        navigable: Boolean(route)
      };
    }

    if (!route) {
      return {
        ...definition,
        route: null,
        status: 'unverified',
        statusLabel: 'Not registered',
        navigable: false
      };
    }

    return {
      ...definition,
      route,
      status: 'available',
      statusLabel: 'Available',
      navigable: true
    };
  });
}
