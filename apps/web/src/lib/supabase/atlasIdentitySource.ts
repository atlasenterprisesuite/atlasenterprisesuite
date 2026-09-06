import type { SupabaseClient } from '@supabase/supabase-js';
import type { AtlasPermission } from '../../../../../packages/core/src';
import type { AtlasIdentitySource, AtlasIdentityState } from '../../app/AtlasContext';

type RolePermissionRow = { permission_code: string };
type OrganizationPermissionOverrideRow = { permission_code: string; allowed: boolean };

export function mergeAtlasPermissions(
  baseRows: readonly RolePermissionRow[],
  overrideRows: readonly OrganizationPermissionOverrideRow[],
): AtlasPermission[] {
  const permissions = new Set<AtlasPermission>();

  for (const row of baseRows) {
    if (row.permission_code) permissions.add(row.permission_code);
  }

  for (const row of overrideRows) {
    if (!row.permission_code) continue;
    if (row.allowed) permissions.add(row.permission_code);
    else permissions.delete(row.permission_code);
  }

  return [...permissions].sort();
}

async function resolveIdentity(client: SupabaseClient | null): Promise<AtlasIdentityState> {
  if (!client) return { status: 'configuration_required' };

  const { data: sessionData, error: sessionError } = await client.auth.getSession();
  if (sessionError) return { status: 'error', message: 'Unable to read the ATLAS authentication session.' };
  if (!sessionData.session) return { status: 'authentication_required' };

  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError || !userData.user) return { status: 'authentication_required' };

  const userId = userData.user.id;
  const { data: membership, error: membershipError } = await client
    .from('organization_members')
    .select('org_id, role, status')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (membershipError) {
    return { status: 'error', message: 'Unable to resolve the ATLAS organization membership.' };
  }

  if (!membership) return { status: 'organization_required', userId };

  const { data: organization, error: organizationError } = await client
    .from('organizations')
    .select('id, name, active')
    .eq('id', membership.org_id)
    .maybeSingle();

  if (organizationError) {
    return { status: 'error', message: 'Unable to resolve the ATLAS organization.' };
  }

  if (!organization || organization.active === false) {
    return { status: 'organization_required', userId };
  }

  const [basePermissionsResult, overridesResult] = await Promise.all([
    client
      .from('identity_role_permissions')
      .select('permission_code')
      .eq('role', membership.role),
    client
      .from('organization_role_permissions')
      .select('permission_code, allowed')
      .eq('org_id', organization.id)
      .eq('role', membership.role),
  ]);

  if (basePermissionsResult.error || overridesResult.error) {
    return {
      status: 'error',
      message: 'Unable to resolve ATLAS permissions for the active organization.',
    };
  }

  const permissions = mergeAtlasPermissions(
    (basePermissionsResult.data ?? []) as RolePermissionRow[],
    (overridesResult.data ?? []) as OrganizationPermissionOverrideRow[],
  );

  return {
    status: 'ready',
    userId,
    organizationId: organization.id,
    organizationName: organization.name,
    role: membership.role,
    permissions,
  };
}

export function createAtlasIdentitySource(client: SupabaseClient | null): AtlasIdentitySource {
  return {
    resolve: () => resolveIdentity(client),
    subscribe: client
      ? (listener) => {
          const { data } = client.auth.onAuthStateChange(() => listener());
          return () => data.subscription.unsubscribe();
        }
      : undefined,
  };
}
