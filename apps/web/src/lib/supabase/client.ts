import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export interface AtlasSupabaseConfig {
  url: string;
  publishableKey: string;
}

export function readAtlasSupabaseConfig(): AtlasSupabaseConfig | null {
  const url = import.meta.env.VITE_SUPABASE_URL?.trim();
  const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

  if (!url || !publishableKey) return null;

  return { url, publishableKey };
}

export function createAtlasSupabaseClient(
  config: AtlasSupabaseConfig | null = readAtlasSupabaseConfig(),
): SupabaseClient | null {
  if (!config) return null;

  return createClient(config.url, config.publishableKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
}
