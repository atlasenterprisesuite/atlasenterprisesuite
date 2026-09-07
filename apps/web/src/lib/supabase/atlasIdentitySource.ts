import type { SupabaseClient } from '@supabase/supabase-js';
import type { AtlasIdentitySource, AtlasIdentityState } from '../../app/AtlasContext';
import {
  mapAtlasIdentityContextRow,
  type AtlasIdentityContextRow,
} from './atlasIdentityContract';

async function resolveIdentity(client: SupabaseClient | null): Promise<AtlasIdentityState> {
  if (!client) return { status: 'configuration_required' };

  const { data: sessionData, error: sessionError } = await client.auth.getSession();
  if (sessionError) return { status: 'error', message: 'Unable to read the ATLAS authentication session.' };
  if (!sessionData.session) return { status: 'authentication_required' };

  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError || !userData.user) return { status: 'authentication_required' };

  const userId = userData.user.id;
  const { data: contextRows, error: contextError } = await client.rpc('atlas_identity_context');

  if (contextError) {
    return {
      status: 'error',
      message: 'Unable to resolve the ATLAS tenant and organization context.',
    };
  }

  const contextRow = Array.isArray(contextRows) ? contextRows[0] : null;
  if (!contextRow) return { status: 'organization_required', userId };

  return mapAtlasIdentityContextRow(userId, contextRow as AtlasIdentityContextRow);
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
