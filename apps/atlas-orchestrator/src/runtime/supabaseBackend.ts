import type { SupabaseRestConfig } from '../../../../packages/ai-core/src';

export function resolveSupabaseBackendConfig(env: Record<string, string | undefined>): SupabaseRestConfig | null {
  const url = env.ATLAS_SUPABASE_URL ?? env.SUPABASE_URL;
  const serviceRoleKey = env.ATLAS_SUPABASE_SERVICE_ROLE_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url && !serviceRoleKey) return null;
  if (!url || !serviceRoleKey) {
    throw new Error('ATLAS Supabase backend requires both URL and service role key');
  }
  return { url, serviceRoleKey };
}
