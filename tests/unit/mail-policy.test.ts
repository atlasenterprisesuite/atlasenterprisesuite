import { describe, expect, it } from 'vitest';
import { mailDomainReady, normalizeMailDomain, requireMailTenantAccess } from '../../packages/core/src/mail/mailPolicy';

describe('ATLAS Mail fail-closed policy', () => {
  it('normalizes valid domain names and rejects malformed input', () => {
    expect(normalizeMailDomain(' Example.COM ')).toBe('example.com');
    for (const invalid of ['localhost', 'bad..example.com', '-bad.example.com', 'a.example.com/path', '']) {
      expect(() => normalizeMailDomain(invalid)).toThrow('mail_domain_invalid');
    }
  });

  it('rejects cross-tenant access, missing admin privileges and missing MFA', () => {
    const valid = { actorTenantId: 'a', resourceTenantId: 'a', role: 'admin', mfaVerified: true };
    expect(() => requireMailTenantAccess(valid)).not.toThrow();
    expect(() => requireMailTenantAccess({ ...valid, resourceTenantId: 'b' })).toThrow('mail_tenant_access_denied');
    expect(() => requireMailTenantAccess({ ...valid, role: 'viewer' })).toThrow('mail_admin_required');
    expect(() => requireMailTenantAccess({ ...valid, mfaVerified: false })).toThrow('mail_mfa_required');
  });

  it('does not report domain readiness unless every provider and DNS gate passes', () => {
    const valid = { ownershipVerified: true, mxVerified: true, spfVerified: true, dkimVerified: true, dmarcVerified: true, providerAuthorized: true };
    expect(mailDomainReady(valid)).toBe(true);
    for (const key of Object.keys(valid) as Array<keyof typeof valid>) {
      expect(mailDomainReady({ ...valid, [key]: false })).toBe(false);
    }
  });
});
