import { describe, expect, it } from 'vitest';
import { mapAtlasIdentityContext, mergeAtlasPermissions } from '../../apps/web/src/lib/supabase/atlasIdentitySource';

describe('ATLAS identity permission resolution', () => {
  it('applies organization role overrides on top of base role permissions', () => {
    expect(mergeAtlasPermissions([{ permission_code: 'accounting.read' }, { permission_code: 'modules.read' }, { permission_code: 'telecom.mifi.read' }], [{ permission_code: 'modules.read', allowed: false }, { permission_code: 'telecom.mifi.forwarding.write', allowed: true }])).toEqual(['accounting.read', 'telecom.mifi.forwarding.write', 'telecom.mifi.read']);
  });
  it('deduplicates base permissions and fails closed on an explicit deny override', () => {
    expect(mergeAtlasPermissions([{ permission_code: 'ride.read' }, { permission_code: 'ride.read' }], [{ permission_code: 'ride.read', allowed: false }])).toEqual([]);
  });
  it('maps the governed v2 identity context with the full tenant scope', () => {
    expect(mapAtlasIdentityContext('user-1', { tenant_id: 'tenant-1', tenant_name: 'ATLAS', organization_id: 'org-1', organization_name: 'Enterprise', role: 'owner', permissions: ['accounting.read', 'accounting.read'] })).toEqual({ status: 'ready', userId: 'user-1', tenantId: 'tenant-1', tenantName: 'ATLAS', organizationId: 'org-1', organizationName: 'Enterprise', role: 'owner', permissions: ['accounting.read'] });
  });
  it('fails closed when the v2 identity context omits tenant scope', () => {
    expect(mapAtlasIdentityContext('user-1', { tenant_id: '', tenant_name: 'ATLAS', organization_id: 'org-1', organization_name: 'Enterprise', role: 'owner', permissions: [] })).toEqual({ status: 'error', message: 'ATLAS identity context is missing tenant scope.' });
  });
});
