import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveIntelligenceContext } from '../../supabase/functions/atlas-copilot/atlas-intelligence-auth.mjs';
import { createCouncilOrchestrator } from '../../supabase/functions/atlas-copilot/council-orchestrator.mjs';
import { createToolGateway } from '../../supabase/functions/atlas-copilot/tool-gateway.mjs';

const ORG_A='11111111-1111-4111-8111-111111111111';
const ORG_B='22222222-2222-4222-8222-222222222222';
const USER='33333333-3333-4333-8333-333333333333';
const response=(body,status=200)=>({ok:status>=200&&status<300,status,json:async()=>body});
const request=(org,token='valid')=>({headers:new Headers({'authorization':`Bearer ${token}`,'x-atlas-org-id':org})});
function mockFetch(url,opts){
  if(url.endsWith('/auth/v1/user'))return Promise.resolve(response({id:USER}));
  if(url.includes('/organization_members?'))return Promise.resolve(response([{org_id:ORG_A,role:'member',status:'active'}]));
  if(url.includes('/identity_role_permissions?'))return Promise.resolve(response([{permission_code:'intelligence.use'}]));
  throw Error('unexpected_mock_endpoint');
}
const context=req=>resolveIntelligenceContext({request:req,supabaseUrl:'https://example.supabase.co',publishableKey:'test-publishable',fetchFn:mockFetch});

test('rejects missing bearer without calling identity service',async()=>{
  await assert.rejects(context({headers:new Headers({'x-atlas-org-id':ORG_A})}),{code:'authentication_required',status:401});
});
test('rejects organization not in active memberships',async()=>{
  await assert.rejects(context(request(ORG_B)),{code:'organization_membership_required',status:403});
});
test('accepts authorized member only within own organization',async()=>{
  const result=await context(request(ORG_A));
  assert.equal(result.context.organization_id,ORG_A);
  assert.equal(result.context.user_id,USER);
});
test('rejects invalid token on auth endpoint',async()=>{
  await assert.rejects(resolveIntelligenceContext({request:request(ORG_A),supabaseUrl:'https://example.supabase.co',publishableKey:'test-publishable',fetchFn:async()=>response({},401)}),{code:'authentication_required',status:401});
});
test('council fails closed when fewer than two providers succeed',async()=>{
  const registry=new Map([['one',{execute:async()=>({text:'ok'})}],['two',{execute:async()=>{throw Object.assign(Error('offline'),{code:'provider_unavailable'});}}]]);
  await assert.rejects(createCouncilOrchestrator({registry}).execute({providerIds:['one','two'],input:'test'}),{code:'provider_unavailable',status:502});
});
test('council output is contributions, not a claimed consensus',async()=>{
  const registry=new Map([['one',{execute:async()=>({text:'yes'})}],['two',{execute:async()=>({text:'no'})}]]);
  const result=await createCouncilOrchestrator({registry}).execute({providerIds:['one','two'],input:'test'});
  assert.equal(result.contributions.length,2);
  assert.match(result.text,/yes/);
  assert.match(result.text,/no/);
  assert.equal(result.decision,undefined);
});
test('tool gateway does not auto-execute sensitive proposals',()=>{
  const result=createToolGateway().evaluate({context:{permissions:['finance.write']},proposals:[{tool_name:'pay',required_permissions:['finance.write'],risk_class:'critical',side_effect:'payment',cost_class:'paid'}]});
  assert.equal(result.accepted.length,0);
  assert.equal(result.approval_required.length,1);
});
test('tool gateway denies missing permission',()=>{
  const result=createToolGateway().evaluate({context:{permissions:[]},proposals:[{tool_name:'pay',required_permissions:['finance.write'],risk_class:'critical',side_effect:'payment'}]});
  assert.equal(result.denied.length,1);
  assert.equal(result.accepted.length,0);
});
