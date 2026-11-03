import { describe, expect, it } from 'vitest';
import { transitionGrowthLead, type GrowthLead } from '../../packages/growth/leadQualification';
const base: GrowthLead = { tenantId: 'org-a', leadId: 'lead-1', stage: 'new', consentToContact: true, verifiedTenantAccess: true };
describe('Growth Engine F1 fail closed', () => {
  it('permits a single valid progression', () => expect(transitionGrowthLead(base, 'qualified', 'org-a')).toEqual({ allowed: true, nextStage: 'qualified' }));
  it('denies cross tenant access', () => expect(transitionGrowthLead(base, 'qualified', 'org-b')).toEqual({ allowed: false, reason: 'ACCESS_DENIED' }));
  it('denies revoked tenant access', () => expect(transitionGrowthLead({ ...base, verifiedTenantAccess: false }, 'qualified', 'org-a')).toEqual({ allowed: false, reason: 'ACCESS_DENIED' }));
  it('denies skipped stages', () => expect(transitionGrowthLead(base, 'customer', 'org-a')).toEqual({ allowed: false, reason: 'INVALID_TRANSITION' }));
  it('requires contact consent for enrollment', () => expect(transitionGrowthLead({ ...base, stage: 'qualified', consentToContact: false }, 'enrolled', 'org-a')).toEqual({ allowed: false, reason: 'CONSENT_REQUIRED' }));
  it('denies unknown stages', () => expect(transitionGrowthLead({ ...base, stage: 'hacked' as GrowthLead['stage'] }, 'qualified', 'org-a')).toEqual({ allowed: false, reason: 'INVALID_INPUT' }));
});
