export * from './scope';
export * from './permissions';
export * from './audit';
export * from './integrations';
export * from './endpoints';

import type { TenantScope } from './scope';
import type { AtlasPermission } from './permissions';

export const demoAtlasContext = {
  scope: { tenantId: 'tenant-demo', organizationId: 'org-demo' } satisfies TenantScope,
  actorId: 'demo-user',
  permissions: ['accounting.read'] as AtlasPermission[],
  environment: 'demo' as const
};
