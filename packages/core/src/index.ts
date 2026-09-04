export * from './tenancy';
export * from './rbac';
export * from './audit';
export * from './result';

import type { TenantScope } from './tenancy';
import type { AccountingPermission } from './rbac';

export const demoAtlasContext = {
  scope: { tenantId: 'tenant-demo', organizationId: 'org-demo' } satisfies TenantScope,
  actorId: 'demo-user',
  permissions: ['accounting.read'] as AccountingPermission[],
  environment: 'demo' as const
};
