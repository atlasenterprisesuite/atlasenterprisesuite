import { createClient } from 'npm:@supabase/supabase-js@2.95.0';
import type { CompliancePermission } from '../../../../packages/compliance/types.ts';

const URL = Deno.env.get('SUPABASE_URL') || '';
const PUBLISHABLE = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY') || '';
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

export type RideComplianceContext = {
  userId: string;
  organizationId: string;
  tenantId: string;
  role: string;
  permissions: CompliancePermission[];
  userClient: ReturnType<typeof createClient>;
  storageAdmin: ReturnType<typeof createClient>;
};

export function permissionsForRole(role: string): CompliancePermission[] {
  if (['owner', 'admin', 'platform_admin'].includes(role)) {
    return [
      'ride.compliance.read',
      'ride.compliance.submit',
      'ride.compliance.review',
      'ride.compliance.manage'
    ];
  }
  return ['ride.compliance.read', 'ride.compliance.submit'];
}

function bearerToken(req: Request) {
  return (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function createUserClient(req: Request) {
  const authorization = req.headers.get('authorization') || '';
  return createClient(URL, PUBLISHABLE, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authorization } }
  });
}

function createStorageAdmin() {
  return createClient(URL, SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

export async function resolveContext(req: Request): Promise<RideComplianceContext> {
  if (!URL || !PUBLISHABLE) throw new Error('supabase_runtime_not_configured');
  if (!SERVICE_ROLE) throw new Error('server_secret_not_configured');

  const token = bearerToken(req);
  if (!token) throw new Error('authentication_required');

  const userClient = createUserClient(req);
  const { data, error } = await userClient.auth.getUser(token);
  if (error || !data.user) throw new Error('invalid_session');

  const requestedOrg = (req.headers.get('x-atlas-org-id') || '').trim();
  if (requestedOrg && !isUuid(requestedOrg)) throw new Error('invalid_organization');

  let membershipQuery = userClient
    .from('organization_members')
    .select('org_id,role,status')
    .eq('user_id', data.user.id)
    .eq('status', 'active');

  if (requestedOrg) membershipQuery = membershipQuery.eq('org_id', requestedOrg);

  const { data: memberships, error: membershipError } = await membershipQuery.limit(1);
  if (membershipError) throw new Error('active_organization_required');

  const membership = memberships?.[0];
  if (!membership?.org_id) {
    throw new Error(requestedOrg ? 'organization_membership_required' : 'active_organization_required');
  }

  const organizationId = String(membership.org_id);
  const role = String(membership.role || 'member');

  return {
    userId: data.user.id,
    organizationId,
    // Canonical compatibility rule for this slice: tenant_id equals organization_id.
    tenantId: organizationId,
    role,
    permissions: permissionsForRole(role),
    userClient,
    storageAdmin: createStorageAdmin()
  };
}
