import { createClient } from 'npm:@supabase/supabase-js@2.95.0';
import { createDataRoomReadHandler } from '../../../packages/security/secure-data-room-http.ts';
import { createScopedSupabaseDataRoomSources } from '../../../packages/security/secure-data-room-supabase-sources.ts';
import type { DataRoomScopedRead } from '../../../packages/security/secure-data-room-supabase-sources.ts';
import type { TrustedDataRoomSources } from '../../../packages/security/secure-data-room-trusted-adapter.ts';

// PREDEPLOY ONLY: no authoritative session revocation or privileged audit
// transaction is certified. SessionActive remains false; no downloads or URLs.
const url = Deno.env.get('SUPABASE_URL') || '';
const publishable = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY') || '';

function userClient(token: string) {
  if (!url || !publishable || !token) return null;
  return createClient(url, publishable, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: 'Bearer ' + token } }
  });
}

// Per-request bearer is supplied explicitly to every query; do not store
// mutable request identity on a shared Deno.serve singleton.
const readOne: DataRoomScopedRead = async (token, table, columns, equals) => {
  const client = userClient(token);
  if (!client) return null;
  let query = client.from(table).select(columns);
  for (const [column, value] of Object.entries(equals)) {
    query = query.eq(column, value);
  }
  const { data, error } = await query.maybeSingle();
  if (error || !data || typeof data !== 'object' || Array.isArray(data)) return null;
  return data as Record<string, unknown>;
};

const sources: TrustedDataRoomSources = {
  authenticate: async token => {
    const client = userClient(token);
    if (!client) return null;
    const { data, error } = await client.auth.getUser(token);
    if (error || !data.user) return null;
    // getUser alone is insufficient for immediate session revocation.
    // Never claim an active session without server-side session verification.
    return { userId: data.user.id, sessionActive: false };
  },
  ...createScopedSupabaseDataRoomSources(readOne)
};

Deno.serve(createDataRoomReadHandler(sources));
