import { createClient } from 'npm:@supabase/supabase-js@2.95.0';
import type { HospitalityPermission } from '../../../../packages/hospitality/types.ts';

const URL = Deno.env.get('SUPABASE_URL') || '';
const PUBLISHABLE = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY') || '';

export type HospitalityRequestContext = {
  sb: ReturnType<typeof createClient>;
  userId: string;
  orgId: string;
  role: string;
  permissions: HospitalityPermission[];
};

function permissionsForRole(role: string): HospitalityPermission[] {
  if (['owner', 'admin', 'platform_admin'].includes(role)) {
    return [
      'hospitality.access.read',
      'hospitality.access.issue',
      'hospitality.access.revoke',
      'hospitality.access.configure',
      'hospitality.access.audit',
      'hospitality.access.admin'
    ];
  }
  return ['hospitality.access.read'];
}

function userClient(req: Request) {
  const auth = req.headers.get('authorization') || '';
  return createClient(URL, PUBLISHABLE, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: auth } }
  });
}

export async function resolveContext(req: Request): Promise<HospitalityRequestContext> {
  if (!URL || !PUBLISHABLE) throw new Error('supabase_runtime_not_configured');

  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) throw new Error('authentication_required');

  const sb = userClient(req);
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data.user) throw new Error('invalid_session');

  const { data: memberships, error: membershipError } = await sb
    .from('organization_members')
    .select('org_id,role,status')
    .eq('user_id', data.user.id)
    .eq('status', 'active')
    .limit(1);

  if (membershipError || !memberships?.[0]?.org_id) throw new Error('active_organization_required');

  const role = String(memberships[0].role || 'member');
  return {
    sb,
    userId: data.user.id,
    orgId: String(memberships[0].org_id),
    role,
    permissions: permissionsForRole(role)
  };
}
