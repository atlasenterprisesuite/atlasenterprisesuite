import { createClient } from 'npm:@supabase/supabase-js@2.95.0';
import { creatorPermissionsForRole } from '../../../../packages/creator/permissions.ts';
import type { CreatorPermission } from '../../../../packages/creator/types.ts';
import { creatorError } from './errors.ts';

const URL = Deno.env.get('SUPABASE_URL') || '';
const PUBLISHABLE = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY') || '';

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export type CreatorContext = {
  sb: ReturnType<typeof createClient>;
  userId: string;
  orgId: string;
  role: string;
  permissions: CreatorPermission[];
};

export async function resolveCreatorContext(req: Request): Promise<CreatorContext> {
  if (!URL || !PUBLISHABLE) throw creatorError('supabase_runtime_not_configured', 503);
  const auth = req.headers.get('authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '');
  if (!token) throw creatorError('authentication_required', 401);
  const sb = createClient(URL, PUBLISHABLE, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: auth } }
  });
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data.user) throw creatorError('invalid_session', 401);
  const requestedOrg = (req.headers.get('x-atlas-org-id') || '').trim();
  if (requestedOrg && !isUuid(requestedOrg)) throw creatorError('invalid_organization', 400);
  const { data: memberships, error: membershipError } = await sb
    .from('organization_members')
    .select('org_id,role,status')
    .eq('user_id', data.user.id)
    .eq('status', 'active');
  if (membershipError || !memberships?.length) throw creatorError('active_organization_required', 403);
  const membership = requestedOrg
    ? memberships.find(row => String(row.org_id) === requestedOrg)
    : memberships[0];
  if (!membership) throw creatorError('organization_membership_required', 403);
  const role = String(membership.role || 'member');
  return {
    sb,
    userId: data.user.id,
    orgId: String(membership.org_id),
    role,
    permissions: creatorPermissionsForRole(role)
  };
}
