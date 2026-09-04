import type { SupabaseClient } from '@supabase/supabase-js';
import type { AccountingPermission } from '../../../../../packages/core/src';
import type { AtlasIdentitySource, AtlasIdentityState } from '../../app/AtlasContext';

const ACCOUNTING_WRITE_ROLES = new Set(['owner', 'admin', 'accountant']);

function permissionsForRole(role: string): AccountingPermission[] {
  const permissions: AccountingPermission[] = ['accounting.read'];

  if (ACCOUNTING_WRITE_ROLES.has(role)) {
    permissions.push('accounting.write', 'audit.read');
  }

  return permissions;
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

  return {
    status: 'ready',
    userId,
    organizationId: organization.id,
    organizationName: organization.name,
    role: membership.role,
    permissions: permissionsForRole(membership.role),
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
