import { createClient } from 'npm:@supabase/supabase-js@2.95.0';
import { createDataRoomReadHandler } from '../../../packages/security/secure-data-room-http.ts';
import type { TrustedDataRoomSources } from '../../../packages/security/secure-data-room-trusted-adapter.ts';

// NOT DEPLOYABLE: no canonical document/grant schema or authoritative session
// revocation source has been verified for Secure Data Room 777.
// Keep the runtime fail-closed until those contracts are implemented and tested.
const url = Deno.env.get('SUPABASE_URL') || '';
const publishable = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY') || '';

const sources: TrustedDataRoomSources = {
  authenticate: async token => {
    if (!url || !publishable) return null;
    const client = createClient(url, publishable, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: 'Bearer ' + token } }
    });
    const { data, error } = await client.auth.getUser(token);
    if (error || !data.user) return null;
    // getUser validates token/user but does not by itself prove immediate
    // server-side session revocation. Do not assert sessionActive=true.
    return { userId: data.user.id, sessionActive: false };
  },
  document: async () => null,
  membership: async () => null,
  grant: async () => false
};

Deno.serve(createDataRoomReadHandler(sources));
