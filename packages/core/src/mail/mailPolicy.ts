/** ATLAS Mail: pure, provider-independent input validation. No mailbox provisioning. */
export function normalizeMailDomain(value: string): string {
  const domain = value.trim().toLowerCase();
  if (domain.length > 253 || !/^(?=.{1,253}$)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/.test(domain)) {
    throw new Error('mail_domain_invalid');
  }
  return domain;
}

export function requireMailTenantAccess(input: {
  actorTenantId: string;
  resourceTenantId: string;
  role: string;
  mfaVerified: boolean;
}): void {
  if (!input.actorTenantId || !input.resourceTenantId || input.actorTenantId !== input.resourceTenantId) {
    throw new Error('mail_tenant_access_denied');
  }
  if (!['owner', 'admin'].includes(input.role)) {
    throw new Error('mail_admin_required');
  }
  if (!input.mfaVerified) {
    throw new Error('mail_mfa_required');
  }
}

export function mailDomainReady(input: {
  ownershipVerified: boolean;
  mxVerified: boolean;
  spfVerified: boolean;
  dkimVerified: boolean;
  dmarcVerified: boolean;
  providerAuthorized: boolean;
}): boolean {
  return Object.values(input).every(value => value === true);
}
