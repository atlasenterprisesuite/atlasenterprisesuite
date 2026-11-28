import { describe, expect, it } from 'vitest';
import { digestApprovalPayload, evaluateAtlasPrivacyPreflight, type AtlasPrivacyPreflightInput } from '../../packages/execution/src';

const now=Date.parse('2026-11-28T12:00:00Z');
const flow={category:'contact',purpose:'account',linked:true,recipient:'local',retentionDays:30};
const inventory=JSON.stringify({manifests:[{schema:'atlas.privacy.v1',module:'identity',collection:[flow]}],observations:[{module:'identity',...flow}]});
async function fixture(): Promise<AtlasPrivacyPreflightInput> {
  const payloadDigest=await digestApprovalPayload({operation:'synthetic'});
  return {
    context:{source:'server',requestId:'req',sessionId:'session',userId:'user',tenantId:'tenant',organizationId:'org',permissions:['execution.read']},
    policy:{requiredPermissions:['execution.read'],payloadVersion:1,payloadDigest,action:{autonomyLevel:'manual',sensitivity:'low',reversible:true,mutation:false,paidCost:0,budgetLimit:0,envelopeAllowed:true,regulated:false}},
    inventory,
    consent:{id:'receipt',status:'granted',userId:'user',tenantId:'tenant',organizationId:'org',sessionId:'session',requestId:'req',payloadVersion:1,payloadDigest,inventoryDigest:await digestApprovalPayload(inventory),grantedAtMs:now-1000,expiresAtMs:now+1000,revokedAtMs:null},
    nowMs:now
  };
}
describe('privacy preflight composes canonical policy, context and consent',()=>{
  it('returns only a candidate, never runtime authorization',async()=>{
    const result=await evaluateAtlasPrivacyPreflight(await fixture());
    expect(result.status).toBe('eligible_for_transaction');
    expect(result.authorization).toBe('not_granted');
    expect(result.verified).toBe(false);
  });
  it('denies missing, revoked, expired or future consent',async()=>{
    const f=await fixture();
    for(const consent of [null,{...f.consent!,revokedAtMs:now-1},{...f.consent!,expiresAtMs:now},{...f.consent!,grantedAtMs:now+1}]){
      expect((await evaluateAtlasPrivacyPreflight({...f,consent})).status).toBe('blocked');
    }
  });
  it('denies any mismatch of identity, tenant, organization, session, request or payload',async()=>{
    const f=await fixture();
    for(const key of ['userId','tenantId','organizationId','sessionId','requestId','payloadDigest','inventoryDigest'] as const){
      expect((await evaluateAtlasPrivacyPreflight({...f,consent:{...f.consent!,[key]:'other'}})).status).toBe('blocked');
    }
    expect((await evaluateAtlasPrivacyPreflight({...f,consent:{...f.consent!,payloadVersion:2}})).status).toBe('blocked');
  });
  it('denies absent permissions even with consent and rejects client context',async()=>{
    const f=await fixture();
    expect((await evaluateAtlasPrivacyPreflight({...f,context:{...f.context,permissions:[]}})).status).toBe('blocked');
    expect((await evaluateAtlasPrivacyPreflight({...f,context:{...f.context,source:'client' as 'server'}})).status).toBe('blocked');
  });
  it('denies incomplete inventory and changes to consent-bound inventory',async()=>{
    const f=await fixture();
    const incomplete=JSON.stringify({manifests:JSON.parse(inventory).manifests,observations:[]});
    expect((await evaluateAtlasPrivacyPreflight({...f,inventory:incomplete,consent:{...f.consent!,inventoryDigest:await digestApprovalPayload(incomplete)}})).status).toBe('blocked');
    expect((await evaluateAtlasPrivacyPreflight({...f,inventory:inventory+' '})).status).toBe('blocked');
  });
  it('cannot bypass approval, empty permission requirements, budget or envelope',async()=>{
    const f=await fixture();
    for(const policy of [{...f.policy,requiredPermissions:[]},{...f.policy,action:{...f.policy.action,envelopeAllowed:false}},{...f.policy,action:{...f.policy.action,paidCost:1}},{...f.policy,action:{...f.policy.action,mutation:true}}]){
      expect((await evaluateAtlasPrivacyPreflight({...f,policy})).status).toBe('blocked');
    }
  });
});

describe('privacy policy runtime input must fail closed (777)',()=>{
  it.each([
    ['mutation',undefined],['mutation','false'],['regulated',undefined],
    ['reversible',null],['envelopeAllowed','true'],
    ['autonomyLevel','unknown'],['sensitivity','unknown'],
    ['paidCost',NaN],['paidCost',Infinity],['paidCost',-1],['paidCost','1'],
    ['budgetLimit',NaN],['budgetLimit',Infinity],['budgetLimit',-1],
    ['budgetLimit','1']
  ])('rejects invalid action field %s',async(key,value)=>{
    const f=await fixture();
    const action={...f.policy.action,[String(key)]:value} as typeof f.policy.action;
    const result=await evaluateAtlasPrivacyPreflight({...f,policy:{...f.policy,action}});
    expect(result.status).toBe('blocked');
    expect(result.authorization).toBe('not_granted');
  });
  it('rejects missing action and extra action fields',async()=>{
    const f=await fixture();
    for(const action of [undefined,{...f.policy.action,unexpected:true}]){
      const result=await evaluateAtlasPrivacyPreflight({...f,policy:{...f.policy,action:action as typeof f.policy.action}});
      expect(result.status).toBe('blocked');
    }
  });
});

describe('privacy preflight uses an internally consistent decision snapshot',()=>{
  it('does not turn a denied action into a candidate during asynchronous hashing',async()=>{
    const f=await fixture();
    f.policy.action.mutation=true;
    const pending=evaluateAtlasPrivacyPreflight(f);
    f.policy.action.mutation=false;
    const result=await pending;
    expect(result.status).toBe('blocked');
    expect(result.authorization).toBe('not_granted');
  });
  it('rejects non-string permissions before canonical normalization',async()=>{
    const f=await fixture();
    const context={...f.context,permissions:[{toString:()=> 'execution.read'}] as unknown as string[]};
    expect((await evaluateAtlasPrivacyPreflight({...f,context})).status).toBe('blocked');
  });
  it('rejects non-string session and identity fields',async()=>{
    const f=await fixture();
    for(const field of ['sessionId','userId','tenantId','organizationId','requestId'] as const){
      const context={...f.context,[field]:{toString:()=>f.context[field]}} as unknown as typeof f.context;
      expect((await evaluateAtlasPrivacyPreflight({...f,context})).status).toBe('blocked');
    }
  });
});
