import { createClient, type SupabaseClient, type User } from 'npm:@supabase/supabase-js@2';
import { SecurityProtectionError } from './errors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const PUBLISHABLE_KEY = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY') || '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

export type SecurityRequestContext = {
  user: User;
  userId: string;
  orgId: string;
  role: string;
  bearer: string;
  userClient: SupabaseClient;
  adminClient: SupabaseClient;
};

function requireRuntime() {
  if (!SUPABASE_URL || !PUBLISHABLE_KEY || !SERVICE_ROLE_KEY) {
    throw new SecurityProtectionError('security_runtime_not_configured', 500);
  }
}

export async function resolveSecurityContext(req: Request): Promise<SecurityRequestContext> {
  requireRuntime();

  const authorization = req.headers.get('authorization') || '';
  if (!authorization.toLowerCase().startsWith('bearer ')) {
    throw new SecurityProtectionError('authentication_required', 401);
  }

  const userClient = createClient(SUPABASE_URL, PUBLISHABLE_KEY, {
    global: { headers: { Authorization: authorization } },
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) {
    throw new SecurityProtectionError('invalid_session', 401);
  }

  const { data: memberships, error: membershipError } = await userClient
    .from('organization_members')
    .select('org_id,role,status')
    .eq('status', 'active')
    .limit(1);

  if (membershipError || !memberships?.[0]?.org_id) {
    throw new SecurityProtectionError('active_organization_required', 403);
  }

  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  return {
    user: userData.user,
    userId: userData.user.id,
    orgId: String(memberships[0].org_id),
    role: String(memberships[0].role || ''),
    bearer: authorization,
    userClient,
    adminClient
  };
}
