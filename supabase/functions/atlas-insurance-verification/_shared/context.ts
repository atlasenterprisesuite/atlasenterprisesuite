import { createClient } from 'npm:@supabase/supabase-js@2.95.0';
import { insuranceError } from './errors.ts';

const URL = Deno.env.get('SUPABASE_URL') || '';
const PUBLISHABLE = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY') || '';
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

export type InsuranceRequestContext = {
  userId: string;
  orgId: string;
  role: string;
  email: string;
  accessToken: string;
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
  if (!SERVICE_ROLE) throw insuranceError('verification_not_configured', 503);
  return createClient(URL, SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

export async function resolveInsuranceContext(req: Request): Promise<InsuranceRequestContext> {
  if (!URL || !PUBLISHABLE) throw insuranceError('verification_not_configured', 503);
  if (!SERVICE_ROLE) throw insuranceError('verification_not_configured', 503);

  const token = bearerToken(req);
  if (!token) throw insuranceError('authentication_required', 401);

  const sb = userClient(req);
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data.user) throw insuranceError('authentication_required', 401);

  const { data: memberships, error: membershipError } = await sb
    .from('organization_members')
    .select('org_id,role,status')
    .eq('user_id', data.user.id)
    .eq('status', 'active')
    .limit(1);

  if (membershipError || !memberships?.[0]?.org_id) {
    throw insuranceError('no_active_organization', 403);
  }

  return {
    userId: data.user.id,
    orgId: String(memberships[0].org_id),
    role: String(memberships[0].role || 'member'),
    email: String(data.user.email || ''),
    accessToken: token,
    admin: adminClient()
  };
}
