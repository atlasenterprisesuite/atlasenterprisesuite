import type { PlanDefinition } from './contracts';

const PLAN_CATALOG: readonly PlanDefinition[] = [
  {
    id: 'core',
    displayName: 'ATLAS Core',
    speedClasses: ['standard'],
    capabilities: [],
  },
  {
    id: 'pro',
    displayName: 'ATLAS Pro',
    speedClasses: ['standard', 'fast'],
    capabilities: ['advanced-models', 'expanded-memory'],
  },
  {
    id: 'max',
    displayName: 'ATLAS MAX',
    speedClasses: ['standard', 'fast', 'max'],
    capabilities: [
      'advanced-models',
      'priority-execution',
      'persistent-operators',
      'expanded-memory',
      'expanded-storage',
    ],
  },
];

export function getPlanCatalog(): readonly PlanDefinition[] {
  return PLAN_CATALOG;
}
