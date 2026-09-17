import {
  InMemoryPersistence,
  SupabasePersistence,
  type PersistencePort,
} from '../../../../packages/ai-core/src';

export type AtlasPersistenceEnvironment = {
  ATLAS_PERSISTENCE_MODE?: string;
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
};

export function resolvePersistence(env: AtlasPersistenceEnvironment): PersistencePort {
  if (env.ATLAS_PERSISTENCE_MODE === 'memory') {
    return new InMemoryPersistence();
  }

  if (env.ATLAS_PERSISTENCE_MODE !== 'supabase') {
    throw new Error('ATLAS persistence mode must be explicitly configured');
  }

  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('ATLAS persistence Supabase configuration is incomplete');
  }

  return new SupabasePersistence({
    url: env.SUPABASE_URL,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
  });
}
