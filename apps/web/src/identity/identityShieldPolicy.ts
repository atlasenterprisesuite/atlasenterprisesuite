/** Fail-closed policy for privileged ATLAS Identity Shield operations.
 * The assurance level and membership MUST come from verified server-side context.
 * This helper is defense in depth, not a substitute for RLS or server authorization.
 */
export type IdentityShieldContext = {
  authenticated: boolean;
  activeOrganizationId: string | null;
  requestedOrganizationId: string | null;
  permissions: readonly string[];
  assuranceLevel: string | null;
  providerVerified: boolean;
};
export function mayManageIdentityShield(context: IdentityShieldContext): boolean {
  return context.providerVerified === true
    && context.authenticated === true
    && Boolean(context.activeOrganizationId)
    && context.activeOrganizationId === context.requestedOrganizationId
    && context.assuranceLevel === 'aal2'
    && context.permissions.includes('identity.shield.manage');
}
