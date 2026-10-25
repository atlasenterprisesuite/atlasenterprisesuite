import { createClient } from 'npm:@supabase/supabase-js@2.95.0';
import { requireIdentityShieldAdmin } from '../_shared/identity-shield-guard.ts';

/** Read-only readiness endpoint. No device enrollment, token issuance or mutation.
 * Feature remains disabled until P0 gates and transactional audit are proven.
 */
Deno.serve(async (req: Request) => {
  const headers = {'content-type':'application/json','cache-control':'no-store'};
  const deny = (status: number) => new Response(JSON.stringify({ok:false,error:'identity_shield_denied'}),{status,headers});
  if (req.method !== 'POST') return deny(405);
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY');
  if (!url || !key) return deny(503);
  const authorization = req.headers.get('authorization') || '';
  const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return deny(401);
  let orgId: unknown;
  try { orgId = (await req.json()).org_id; } catch { return deny(400); }
  if (typeof orgId !== 'string') return deny(400);
  const sb = createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:`Bearer ${token}`}}});
  try {
    await requireIdentityShieldAdmin(sb,orgId);
    return new Response(JSON.stringify({ok:true,enabled:false,reason:'p0_verification_pending'}),{status:200,headers});
  } catch { return deny(403); }
});
