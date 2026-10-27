import { describe, it, expect } from 'vitest';
import { evaluateGenesisCovenant as check } from '../../scripts/genesis-humanity-covenant.mjs';
const req = { organizationId: 'org-a', actorId: 'agent-1', action: 'verify' };
const ctx = { organizationId: 'org-a', actorId: 'agent-1', emergencyStop: false, auditAvailable: true, policyAvailable: true };
const protectedReq = { ...req, action: 'sensor_access', purpose: 'assist' };
const approved = { ...ctx, enforcementGate: 'trusted-server-boundary', permissions: ['sensor_access','personal_data'], nowMs: 1000, auditReceipt: { id: 'receipt-1', organizationId: 'org-a', action: 'sensor_access', persisted: true }, humanApproval: { verified: true, organizationId: 'org-a', actorId: 'agent-1', action: 'sensor_access', revoked: false, expiresAtMs: 2000 }, consent: { organizationId: 'org-a', actorId: 'agent-1', purpose: 'assist', revoked: false, expiresAtMs: 2000 } };
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
    for (const action of ['sensor_access','spend','deploy','self_modify']) expect(check({ ...req,action },ctx).reason).toBe('ENFORCEMENT_GATE_REQUIRED');
  });
  it('requires human approval after the trusted gate, RBAC and audit checks pass', () => {
    for (const action of ['sensor_access','spend','deploy','self_modify']) {
      const trusted = { ...approved, permissions:[action], auditReceipt:{ ...approved.auditReceipt,action }, humanApproval:undefined };
      expect(check({ ...req,action },trusted).reason).toBe('HUMAN_APPROVAL_REQUIRED');
    }
  });
  it('requires active purpose-scoped consent for sensors and personal data', () => {
    expect(check(protectedReq,approved).allowed).toBe(true);
    expect(check(protectedReq,{ ...approved,consent:{ ...approved.consent,revoked:true } }).reason).toBe('CONSENT_REQUIRED');
    expect(check({ ...protectedReq,purpose:'surveillance' },approved).reason).toBe('CONSENT_REQUIRED');
    expect(check({ ...protectedReq,action:'personal_data' },{ ...approved,humanApproval:{ ...approved.humanApproval,action:'personal_data' },auditReceipt:{ ...approved.auditReceipt,action:'personal_data' } }).allowed).toBe(true);
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

describe('Genesis Covenant expiration, RBAC and audit evidence', () => {
  it('rejects expired human approval', () => expect(check(protectedReq,{ ...approved,nowMs:2000 }).reason).toBe('HUMAN_APPROVAL_REQUIRED'));
  it('rejects expired consent', () => expect(check(protectedReq,{ ...approved,consent:{ ...approved.consent,expiresAtMs:1000 } }).reason).toBe('CONSENT_REQUIRED'));
  it('rejects missing or mismatched RBAC', () => {
    expect(check(protectedReq,{ ...approved,permissions:[] }).reason).toBe('RBAC_DENIED');
    expect(check(protectedReq,{ ...approved,permissions:['spend'] }).reason).toBe('RBAC_DENIED');
  });
  it('rejects absent durable audit receipt', () => {
    expect(check(protectedReq,{ ...approved,auditReceipt:null }).reason).toBe('AUDIT_RECEIPT_REQUIRED');
    expect(check(protectedReq,{ ...approved,auditReceipt:{ ...approved.auditReceipt,persisted:false } }).reason).toBe('AUDIT_RECEIPT_REQUIRED');
  });
  it('rejects missing trusted enforcement boundary', () => expect(check(protectedReq,{ ...approved,enforcementGate:undefined }).reason).toBe('ENFORCEMENT_GATE_REQUIRED'));
  it('rejects unknown time and forged approval actor', () => {
    expect(check(protectedReq,{ ...approved,nowMs:undefined }).reason).toBe('TIME_UNVERIFIED');
    expect(check(protectedReq,{ ...approved,humanApproval:{ ...approved.humanApproval,actorId:'other' } }).reason).toBe('HUMAN_APPROVAL_REQUIRED');
  });
});
