import type { ReleaseModuleDefinition, ReleaseModuleFamily, ReleaseWave } from './types';

const FOUNDATION_DEPENDENCIES = ['core', 'identity', 'rbac', 'audit', 'release-controller'] as const;

function defineModule(
  moduleCode: string,
  moduleFamily: ReleaseModuleFamily,
  releaseWave: ReleaseWave,
  dependencies: readonly string[],
): ReleaseModuleDefinition {
  return Object.freeze({
    moduleCode,
    moduleFamily,
    releaseWave,
    dependencies: Object.freeze([...new Set(dependencies)]),
  });
}

function withFoundation(...dependencies: string[]): readonly string[] {
  return [...FOUNDATION_DEPENDENCIES, ...dependencies];
}

export const RELEASE_CATALOG: readonly ReleaseModuleDefinition[] = Object.freeze([
  defineModule('core', 'foundation', 0, []),
  defineModule('identity', 'foundation', 0, ['core']),
  defineModule('rbac', 'foundation', 0, ['core', 'identity']),
  defineModule('audit', 'foundation', 0, ['core', 'identity']),
  defineModule('security', 'foundation', 0, ['core', 'identity', 'rbac', 'audit']),
  defineModule('settings', 'foundation', 0, ['core', 'identity', 'rbac']),
  defineModule('atlas-manager', 'foundation', 0, ['core', 'identity', 'rbac', 'audit']),
  defineModule('observability', 'foundation', 0, ['core', 'audit']),
  defineModule('release-controller', 'foundation', 0, ['core', 'identity', 'rbac', 'audit', 'security']),

  defineModule('finance', 'finance', 1, withFoundation()),
  defineModule('accounting', 'finance', 1, withFoundation('finance')),
  defineModule('gl', 'finance', 1, withFoundation('accounting')),
  defineModule('ap', 'finance', 1, withFoundation('accounting')),
  defineModule('ar', 'finance', 1, withFoundation('accounting')),
  defineModule('bank-cash', 'finance', 1, withFoundation('accounting')),
  defineModule('reconciliation', 'finance', 1, withFoundation('accounting')),

  defineModule('hr', 'people', 2, withFoundation()),
  defineModule('time', 'people', 2, withFoundation('hr')),
  defineModule('payroll', 'people', 2, withFoundation('hr', 'time', 'accounting')),
  defineModule('recruiting', 'people', 2, withFoundation('hr')),
  defineModule('assessments', 'people', 2, withFoundation('recruiting')),
  defineModule('compensation', 'people', 2, withFoundation('hr', 'payroll', 'accounting')),
  defineModule('benefits', 'people', 2, withFoundation('hr', 'payroll')),
  defineModule('self-service', 'people', 2, withFoundation('hr', 'time', 'payroll')),

  defineModule('crm', 'revenue-operations', 3, withFoundation()),
  defineModule('sales', 'revenue-operations', 3, withFoundation('crm', 'customers', 'accounting')),
  defineModule('customers', 'revenue-operations', 3, withFoundation()),
  defineModule('vendors', 'revenue-operations', 3, withFoundation()),
  defineModule('purchasing', 'revenue-operations', 3, withFoundation('vendors', 'inventory', 'accounting')),
  defineModule('inventory', 'revenue-operations', 3, withFoundation()),
  defineModule('pos', 'revenue-operations', 3, withFoundation('sales', 'inventory', 'accounting')),
  defineModule('projects', 'revenue-operations', 3, withFoundation()),
  defineModule('analytics', 'revenue-operations', 3, withFoundation('accounting')),

  defineModule('drive', 'platform-services', 4, withFoundation()),
  defineModule('knowledge', 'platform-services', 4, withFoundation()),
  defineModule('voice', 'platform-services', 4, withFoundation()),
  defineModule('connect', 'platform-services', 4, withFoundation()),
  defineModule('communications', 'platform-services', 4, withFoundation()),
  defineModule('creator-studio', 'platform-services', 4, withFoundation()),
  defineModule('sites', 'platform-services', 4, withFoundation()),

  defineModule('health', 'health', 5, withFoundation()),

  defineModule('ride', 'mobility-physical-operations', 6, withFoundation()),
  defineModule('gps-4d', 'mobility-physical-operations', 6, withFoundation()),
  defineModule('telecom', 'mobility-physical-operations', 6, withFoundation()),
  defineModule('parks', 'mobility-physical-operations', 6, withFoundation()),
  defineModule('autowash', 'mobility-physical-operations', 6, withFoundation()),
  defineModule('insurance', 'mobility-physical-operations', 6, withFoundation()),

  defineModule('atlas-pay', 'financial-rails-specialized', 7, withFoundation('accounting')),
  defineModule('venezuela', 'financial-rails-specialized', 7, withFoundation('accounting')),
  defineModule('specialized', 'financial-rails-specialized', 7, withFoundation()),
]);
