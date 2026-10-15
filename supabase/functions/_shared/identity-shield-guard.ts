/** ATLAS Identity Shield server-side privileged gate.
 * Caller must pass a Supabase client scoped to the request's verified bearer token.
 * Never use a service-role client to check membership or permissions.
 */
export async function requireIdentityShieldAdmin(
  sb: {
    auth: { getUser: () => Promise<{data: {user: {id: string} | null}, error: unknown}> };
    rpc: (name: string, args: Record<string,string>) => Promise<{data: unknown,error: unknown}>;
  },
  verifiedClaims: { aal?: unknown } | null,
  organizationId: string,
): Promise<{userId: string; organizationId: string}> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(organizationId)) {
    throw new Error('identity_shield_denied');
  }
  const {data, error} = await sb.auth.getUser();
  if (error || !data.user?.id || verifiedClaims?.aal !== 'aal2') {
    throw new Error('identity_shield_denied');
  }
  const permission = await sb.rpc('has_identity_permission', {o: organizationId, p: 'identity.shield.manage'});
  if (permission.error || permission.data !== true) {
    throw new Error('identity_shield_denied');
  }
  return {userId: data.user.id, organizationId};
}
/** Mutations must execute atomically with their mandatory audit insert in a DB transaction.
 * Never perform mutation and audit as independent best-effort network requests.
 */
