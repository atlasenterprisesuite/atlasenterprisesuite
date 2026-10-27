import { describe, it, expect } from 'vitest';
import { evaluateGenesisCovenant as check } from '../../scripts/genesis-humanity-covenant.mjs';
const req = { organizationId: 'org-a', actorId: 'agent-1', action: 'verify' };
const ctx = { organizationId: 'org-a', actorId: 'agent-1', emergencyStop: false, auditAvailable: true, policyAvailable: true };
const protectedReq = { ...req, action: 'sensor_access', purpose: 'assist' };
const approved = { ...ctx, humanApproval: { verified: true, organizationId: 'org-a', action: 'sensor_access', revoked: false }, consent: { organizationId: 'org-a', actorId: 'agent-1', purpose: 'assist', revoked: false } };
describe('Genesis Humanity Covenant 777 negative preflight', () => {
  it('allows only preflight verification in healthy context', () => expect(check(req,ctx)).toEqual({ allowed: true, reason: 'PREFLIGHT_ONLY_NOT_EXECUTION_AUTHORIZATION' }));
  it('rejects cross tenant and forged actor', () => {
    expect(check({ ...req, organizationId: 'org-b' },ctx).allowed).toBe(false);
    expect(check({ ...req, actorId: 'other' },ctx).allowed).toBe(false);
  });
  it('fails closed if audit, policy or emergency state is missing', () => {
    for (const patch of [{ auditAvailable: false }, { policyAvailable: false }, { emergencyStop: true }, { emergencyStop: undefined }]) expect(check(req,{ ...ctx,...patch }).allowed).toBe(false);
  });
  it('blocks attempts to disable safeguards, audit or emergency stop', () => {
    for (const action of ['disable_safeguards','disable_audit','disable_emergency_stop','autonomous_violence']) expect(check({ ...req,action },approved).reason).toBe('PROHIBITED_ACTION');
  });
  it('rejects false human identity and divine authority claims', () => {
    expect(check({ ...req,claimsHuman:true },ctx).reason).toBe('MISREPRESENTATION');
    expect(check({ ...req,claimsDivineAuthority:true },ctx).reason).toBe('MISREPRESENTATION');
  });
  it('rejects unapproved sensors, spending, deployment and self-modification', () => {
    for (const action of ['sensor_access','spend','deploy','self_modify']) expect(check({ ...req,action },ctx).reason).toBe('HUMAN_APPROVAL_REQUIRED');
  });
  it('requires active purpose-scoped consent for sensors and personal data', () => {
    expect(check(protectedReq,approved).allowed).toBe(true);
    expect(check(protectedReq,{ ...approved,consent:{ ...approved.consent,revoked:true } }).reason).toBe('CONSENT_REQUIRED');
    expect(check({ ...protectedReq,purpose:'surveillance' },approved).reason).toBe('CONSENT_REQUIRED');
    expect(check({ ...protectedReq,action:'personal_data' },{ ...approved,humanApproval:{ ...approved.humanApproval,action:'personal_data' } }).allowed).toBe(true);
  });
  it('rejects revoked, mismatched or unverifiable human approval', () => {
    expect(check(protectedReq,{ ...approved,humanApproval:{ ...approved.humanApproval,revoked:true } }).allowed).toBe(false);
    expect(check(protectedReq,{ ...approved,humanApproval:{ ...approved.humanApproval,organizationId:'org-b' } }).allowed).toBe(false);
    expect(check(protectedReq,{ ...approved,humanApproval:{ ...approved.humanApproval,verified:false } }).allowed).toBe(false);
  });
  it('rejects unknown action and malformed identity', () => {
    expect(check({ ...req,action:'unknown' },ctx).reason).toBe('UNKNOWN_ACTION');
    expect(check({ ...req,actorId:' ' },ctx).reason).toBe('IDENTITY_INVALID');
  });
});
