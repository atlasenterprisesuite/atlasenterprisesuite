import test from 'node:test';
import assert from 'node:assert/strict';
import { mapAtlasIdentityContextRow } from '../../apps/web/src/lib/supabase/atlasIdentityContract.ts';

test('maps canonical Supabase identity context into a tenant-scoped ready state', () => {
  const result = mapAtlasIdentityContextRow('user-1', {
    tenant_id: 'tenant-1',
    tenant_name: 'Tenant One',
    organization_id: 'org-1',
    organization_name: 'Organization One',
    role: 'owner',
    permissions: ['accounting.write', 'accounting.read', 'accounting.read'],
  });

  assert.deepEqual(result, {
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

test('fails closed when the canonical context does not contain a complete tenant scope', () => {
  const result = mapAtlasIdentityContextRow('user-1', {
    tenant_id: '',
    tenant_name: 'Tenant One',
    organization_id: 'org-1',
    organization_name: 'Organization One',
    role: 'owner',
    permissions: ['accounting.read'],
  });

  assert.deepEqual(result, {
    status: 'error',
    message: 'Unable to resolve a complete ATLAS tenant scope.',
  });
});

test('fails closed when permissions are malformed', () => {
  const result = mapAtlasIdentityContextRow('user-1', {
    tenant_id: 'tenant-1',
    tenant_name: 'Tenant One',
    organization_id: 'org-1',
    organization_name: 'Organization One',
    role: 'owner',
    permissions: 'accounting.read',
  });

  assert.deepEqual(result, {
    status: 'error',
    message: 'Unable to resolve ATLAS permissions for the active organization.',
  });
});
