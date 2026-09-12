export * from './tenancy';
export * from './rbac';
export * from './audit';
export * from './result';

import type { AccountingPermission } from './rbac';
import type { TenantScope } from './tenancy';

export const demoAtlasContext = {
  scope: { tenantId: 'tenant-demo', organizationId: 'org-demo' } satisfies TenantScope,
  actorId: 'demo-user',
  permissions: ['accounting.read'] as AccountingPermission[],
  environment: 'demo' as const
};
