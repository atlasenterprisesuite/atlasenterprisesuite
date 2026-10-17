import { createClient } from 'npm:@supabase/supabase-js@2.95.0';
import { trustError } from './errors.ts';

const URL = Deno.env.get('SUPABASE_URL') || '';
const PUBLISHABLE = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY') || '';
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

export type TrustRequestContext = {
  userId: string;
  orgId: string;
  role: string;
  sessionId: string;
  observedAal: 'anonymous' | 'authenticated' | 'aal2';
  admin: ReturnType<typeof createClient>;
};

function bearerToken(req: Request) {
  return (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
}

function userClient(req: Request) {
  const authorization = req.headers.get('authorization') || '';
  return createClient(URL, PUBLISHABLE, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authorization } }
  });
}

function adminClient() {
  if (!SERVICE_ROLE) throw trustError('trust_not_configured', 503);
  return createClient(URL, SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

function decodeJwtPayload(token: string): Record<string, unknown> {
  try {
    const payload = token.split('.')[1];
    if (!payload) return {};
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(payload.length / 4) * 4, '=');
    const text = new TextDecoder().decode(Uint8Array.from(atob(base64), (char) => char.charCodeAt(0)));
    const decoded = JSON.parse(text);
    return decoded && typeof decoded === 'object' ? decoded : {};
  } catch {
    return {};
  }
}

async function digestSessionHandle(token: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`atlas-trustpass-session:${token}`));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function resolveTrustContext(req: Request): Promise<TrustRequestContext> {
  if (!URL || !PUBLISHABLE || !SERVICE_ROLE) throw trustError('trust_not_configured', 503);

  const token = bearerToken(req);
  if (!token) throw trustError('authentication_required', 401);

  const sb = userClient(req);
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data.user) throw trustError('authentication_required', 401);

  const { data: memberships, error: membershipError } = await sb
    .from('organization_members')
    .select('org_id,role,status')
    .eq('user_id', data.user.id)
    .eq('status', 'active')
    .limit(1);

  if (membershipError || !memberships?.[0]?.org_id) {
    throw trustError('active_organization_required', 403);
  }

  const claims = decodeJwtPayload(token);
  const claimSession = typeof claims.session_id === 'string'
    ? claims.session_id
    : typeof claims.sid === 'string'
      ? claims.sid
      : '';
  const sessionId = claimSession || await digestSessionHandle(token);
  const observedAal = claims.aal === 'aal2' ? 'aal2' : 'authenticated';

  return {
    userId: data.user.id,
    orgId: String(memberships[0].org_id),
    role: String(memberships[0].role || 'member'),
    sessionId,
    observedAal,
    admin: adminClient()
  };
}
