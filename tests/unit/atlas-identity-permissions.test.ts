import { describe, expect, it } from 'vitest';
import { mapAtlasIdentityContextRow } from '../../apps/web/src/lib/supabase/atlasIdentityContract';

describe('ATLAS Supabase v2 identity contract', () => {
  it('maps the canonical tenant and organization context into a ready identity', () => {
    expect(
      mapAtlasIdentityContextRow('user-1', {
        tenant_id: 'tenant-1',
        tenant_name: 'Tenant One',
        organization_id: 'org-1',
        organization_name: 'Organization One',
        role: 'owner',
        permissions: ['accounting.write', 'accounting.read', 'accounting.read'],
      }),
    ).toEqual({
      status: 'ready',
      userId: 'user-1',
      tenantId: 'tenant-1',
      tenantName: 'Tenant One',
      organizationId: 'org-1',
      organizationName: 'Organization One',
      role: 'owner',
      permissions: ['accounting.read', 'accounting.write'],
    });
  });

  it('fails closed when tenant scope is incomplete', () => {
    expect(
      mapAtlasIdentityContextRow('user-1', {
        tenant_id: '',
        tenant_name: 'Tenant One',
        organization_id: 'org-1',
        organization_name: 'Organization One',
        role: 'owner',
        permissions: ['accounting.read'],
      }),
    ).toEqual({
      status: 'error',
      message: 'Unable to resolve a complete ATLAS tenant scope.',
    });
  });

  it('fails closed when permissions are malformed', () => {
    expect(
      mapAtlasIdentityContextRow('user-1', {
        tenant_id: 'tenant-1',
        tenant_name: 'Tenant One',
        organization_id: 'org-1',
        organization_name: 'Organization One',
        role: 'owner',
        permissions: 'accounting.read',
      }),
    ).toEqual({
      status: 'error',
      message: 'Unable to resolve ATLAS permissions for the active organization.',
    });
  });
});
