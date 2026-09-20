import {
  InMemoryPersistence,
  SupabasePersistence,
  SupabaseRpcPersistence,
  type PersistencePort,
} from '../../../../packages/ai-core/src';

export type AtlasPersistenceEnvironment = {
  ATLAS_PERSISTENCE_MODE?: string;
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  SUPABASE_SECRET_KEY?: string;
  ATLAS_ORCHESTRATOR_PERSISTENCE_TOKEN?: string;
};

export function resolvePersistence(env: AtlasPersistenceEnvironment): PersistencePort {
  if (env.ATLAS_PERSISTENCE_MODE === 'memory') {
    return new InMemoryPersistence();
  }

  if (env.ATLAS_PERSISTENCE_MODE !== 'supabase') {
    throw new Error('ATLAS persistence mode must be explicitly configured');
  }

  if (!env.SUPABASE_URL) {
    throw new Error('ATLAS persistence Supabase URL is missing');
  }

  if (env.SUPABASE_SERVICE_ROLE_KEY) {
    return new SupabasePersistence({
      url: env.SUPABASE_URL,
      serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
    });
  }

  if (env.SUPABASE_SECRET_KEY && env.ATLAS_ORCHESTRATOR_PERSISTENCE_TOKEN) {
    return new SupabaseRpcPersistence({
      url: env.SUPABASE_URL,
      secretKey: env.SUPABASE_SECRET_KEY,
      runtimeToken: env.ATLAS_ORCHESTRATOR_PERSISTENCE_TOKEN,
    });
  }

  throw new Error('ATLAS persistence requires a server-only Supabase credential');
}
