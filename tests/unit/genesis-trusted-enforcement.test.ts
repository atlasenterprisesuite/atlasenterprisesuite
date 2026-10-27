import { describe, it, expect, vi } from 'vitest';
import { createGenesisEnforcementGateway } from '../../scripts/genesis-trusted-enforcement.mjs';
const request = { organizationId: 'org-a', actorId: 'agent-1', action: 'sensor_access', purpose: 'assist' };
const state = {
  organizationId:'org-a', actorId:'agent-1', emergencyStop:false, auditAvailable:true,
  policyAvailable:true, permissions:['sensor_access'],
  humanApproval:{ verified:true, organizationId:'org-a', actorId:'agent-1', action:'sensor_access', revoked:false, expiresAtMs:2000 },
  consent:{ organizationId:'org-a', actorId:'agent-1', purpose:'assist', revoked:false, expiresAtMs:2000 },
  auditReceipt:{ id:'receipt-1', organizationId:'org-a', action:'sensor_access', persisted:true }
};
const gateway = (authority=async()=>state, transact=async f=>f({})) =>
  createGenesisEnforcementGateway({ trustedAuthority:authority, transact, clock:()=>1000 });
const effect = vi.fn(async()=>({ status:'completed' }));
describe('Genesis trusted server enforcement boundary',()=>{
  it('does not accept forged approval, role, audit receipt or enforcement marker from request', async()=>{
    const authority=vi.fn(async()=>({ ...state,permissions:[] }));
    const r=await gateway(authority).execute({ ...request,permissions:['sensor_access'],auditReceipt:state.auditReceipt,humanApproval:state.humanApproval,enforcementGate:'trusted-server-boundary' },effect);
    expect(r.reason).toBe('RBAC_DENIED');
    expect(effect).not.toHaveBeenCalled();
    expect(authority.mock.calls[0][0]).not.toHaveProperty('permissions');
  });
  it('executes only with trusted transactional state',async()=>{
    const e=vi.fn(async()=>({status:'completed'}));
    expect((await gateway().execute(request,e)).status).toBe('completed');
    expect(e).toHaveBeenCalledTimes(1);
  });
  it('blocks revoked consent observed inside transaction',async()=>{
    const e=vi.fn(async()=>({status:'completed'}));
    const r=await gateway(async()=>({ ...state,consent:{ ...state.consent,revoked:true } })).execute(request,e);
    expect(r.reason).toBe('CONSENT_REQUIRED');
    expect(e).not.toHaveBeenCalled();
  });
  it('fails closed on transaction error',async()=>{
    const e=vi.fn(async()=>({status:'completed'}));
    const r=await gateway(async()=>state,async()=>{throw Error('rollback');}).execute(request,e);
    expect(r.status).toBe('blocked');
    expect(e).not.toHaveBeenCalled();
  });
  it('blocks missing audit evidence before effect',async()=>{
    const e=vi.fn(async()=>({status:'completed'}));
    const r=await gateway(async()=>({ ...state,auditReceipt:null })).execute(request,e);
    expect(r.reason).toBe('AUDIT_RECEIPT_REQUIRED');
    expect(e).not.toHaveBeenCalled();
  });
  it('blocks false successful effect status',async()=>{
    const r=await gateway().execute(request,async()=>({status:'failed'}));
    expect(r.reason).toBe('TRANSACTION_OR_AUTHORITY_FAILED');
  });
});
