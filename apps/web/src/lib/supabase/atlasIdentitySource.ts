import type { SupabaseClient } from '@supabase/supabase-js';
import type { AtlasPermission } from '../../../../../packages/core/src';
import type { AtlasIdentitySource, AtlasIdentityState } from '../../app/AtlasContext';

type IdentityContextRow = { tenant_id: string; tenant_name: string; organization_id: string; organization_name: string; role: string; permissions: string[] | null };

export function mapAtlasIdentityContext(userId: string, userEmail: string, row: IdentityContextRow): AtlasIdentityState {
  if (!row.tenant_id || !row.organization_id) return { status: 'error', message: 'ATLAS identity context is missing tenant scope.' };
  return {
    status: 'ready',
    userId,
    userEmail,
    tenantId: row.tenant_id,
    tenantName: row.tenant_name,
    organizationId: row.organization_id,
    organizationName: row.organization_name,
    role: row.role,
    permissions: [...new Set((row.permissions ?? []).filter(Boolean))].sort() as AtlasPermission[],
  };
}

async function resolveIdentity(client: SupabaseClient | null): Promise<AtlasIdentityState> {
  if (!client) return { status: 'configuration_required' };
  const { data: sessionData, error: sessionError } = await client.auth.getSession();
  if (sessionError) return { status: 'error', message: 'Unable to read the ATLAS authentication session.' };
  if (!sessionData.session) return { status: 'authentication_required' };
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError || !userData.user) return { status: 'authentication_required' };
  const { data, error } = await client.rpc('atlas_identity_context');
  if (error) return { status: 'error', message: 'Unable to resolve the governed ATLAS identity context.' };
  const rows = (data ?? []) as IdentityContextRow[];
  if (rows.length === 0) return { status: 'organization_required', userId: userData.user.id };
  if (rows.length !== 1) return { status: 'error', message: 'ATLAS identity context is ambiguous.' };
  return mapAtlasIdentityContext(userData.user.id, userData.user.email ?? '', rows[0]);
}

export function createAtlasIdentitySource(client: SupabaseClient | null): AtlasIdentitySource {
  return {
    resolve: () => resolveIdentity(client),
    async signIn(email, password) {
      if (!client) throw new Error('configuration_required');
      const { error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw error;
    },
    async signOut() {
      if (!client) return;
      const { error } = await client.auth.signOut();
      if (error) throw error;
    },
    subscribe: client
      ? (listener) => {
          const { data } = client.auth.onAuthStateChange(() => listener());
          return () => data.subscription.unsubscribe();
        }
      : undefined,
  };
}
