import type { RoboticsAuthorizationProvider, VerifiedRoboticsSession } from './h-series-server-access';

/**
 * Isolated server adapter following atlas-creator/_shared/context.ts:
 * Supabase auth.getUser(token) + organization_members active + organizations active.
 * The caller must inject a user-scoped, RLS-enforced Supabase client, NEVER service_role.
 * No public route or credential is created by this module.
 */
export interface ScopedSupabaseReader {
  auth: { getUser(token?: string): Promise<{ data: { user: { id: string } | null }; error: unknown }> };
  rpc(functionName: string, args: { o: string; p: string }): Promise<{ data: unknown; error: unknown }>;
  from(table: string): {
    select(columns: string): {
      eq(column: string, value: string): { eq(column: string, value: string): Promise<{ data: unknown; error: unknown }> };
    };
  };
}
type Membership = { org_id: string; user_id: string; role: string; status: string };
type Organization = { id: string; active: boolean };
const uuid = (s: string): boolean => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);

/** ATLAS Ride compatibility tenant binding (tenantId=orgId); no guessed tenant mapping. */
export function createHSeriesSupabaseAuthorization(
  accessToken: string,
  orgId: string,
  client: ScopedSupabaseReader
): RoboticsAuthorizationProvider {
  const trustedToken = accessToken;
  const verifiedSessions = new WeakSet<VerifiedRoboticsSession>();
  return {
    async verifiedSession() {
      if (!trustedToken || !uuid(orgId)) return null;
      const { data, error } = await client.auth.getUser(trustedToken);
      if (error || !data.user || !uuid(data.user.id)) return null;
      const bound = await client.auth.getUser();
      if (bound.error || !bound.data.user || bound.data.user.id !== data.user.id) return null;
      const session = { userId: data.user.id, tenantId: orgId, organizationId: orgId };
      verifiedSessions.add(session);
      return session;
    },
    async canReadCatalog(session) {
      if (!verifiedSessions.has(session) || session.organizationId !== orgId) return false;
      verifiedSessions.delete(session); // single-use authorization capability; reject replay
      const memberships = await client.from('organization_members')
        .select('org_id,user_id,role,status').eq('org_id',orgId).eq('user_id',session.userId);
      if (memberships.error || !Array.isArray(memberships.data) || memberships.data.length !== 1) return false;
      const m = memberships.data[0] as Membership;
      if (m.org_id !== orgId || m.user_id !== session.userId || m.status !== 'active' ||
          typeof m.role !== 'string') return false;
      const organizations = await client.from('organizations')
        .select('id,active').eq('id',orgId).eq('id',orgId);
      if (organizations.error || !Array.isArray(organizations.data) || organizations.data.length !== 1) return false;
      const org = organizations.data[0] as Organization;
      if (org.id !== orgId || org.active !== true) return false;
      // Authoritative, live permission check under the same user-scoped JWT.
      // The function signature must be verified against the deployed database before use.
      const permission = await client.rpc('has_identity_permission', {
        o: orgId, p: 'execution.read'
      });
      return !permission.error && permission.data === true;
    }
  };
}
