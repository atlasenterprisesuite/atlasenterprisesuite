import test from 'node:test';
import assert from 'node:assert/strict';
import { createAtlasLocalResponsesAdapter } from '../../supabase/functions/atlas-copilot/atlas-local-responses-adapter.mjs';

const models = {
  fast: 'qwen3-8b',
  balanced: 'gpt-oss-20b',
  deep: 'muse-glimmer-30b',
};

function fakeRuntime({advertised=Object.values(models),modelsStatus=200,malformed=false,responseModel=undefined}={}){
  const requests=[];
  const fetchFn=async (url,options={})=>{
    const path=new URL(url).pathname;
    requests.push({path,body:options.body||null,auth:options.headers?.authorization||null});
    if(path==='/health')return new Response(JSON.stringify({status:'ok'}),{status:200});
    if(path==='/v1/models')return new Response(
      JSON.stringify(malformed?{unexpected:[]}: {data:advertised.map(id=>({id}))}),
      {status:modelsStatus}
    );
    if(path==='/v1/responses')return new Response(JSON.stringify({
      id:'local-response',model:responseModel===undefined?JSON.parse(options.body).model:responseModel,
      output:[{content:[{type:'output_text',text:'synthetic-ok'}]}],
    }),{status:200});
    throw new Error('Unexpected runtime path: '+path);
  };
  const adapter=createAtlasLocalResponsesAdapter({
    baseUrl:'https://private-ai.atlas.example',
    token:'synthetic-test-only',
    models,
    verifyModelId:true,
    probeAttempts:1,
    fetchFn,
  });
  return {adapter,requests};
}

test('strict readiness verifies the exact configured local model for each profile',async()=>{
  const {adapter,requests}=fakeRuntime();
  assert.equal(adapter.descriptor().feature_support.model_id_verification,true);
  for(const [profile,id] of Object.entries(models)){
    const probe=await adapter.probe({profile});
    assert.deepEqual(
      {model:probe.model,configured:probe.configured,verified:probe.verified,error:probe.error},
      {model:id,configured:true,verified:true,error:null},
    );
  }
  assert.equal(requests.filter(r=>r.path==='/v1/models').length,3);
  assert.equal(requests.filter(r=>r.path==='/v1/responses').length,0);
});

test('missing model fails closed before sending conversational content',async()=>{
  const {adapter,requests}=fakeRuntime({advertised:['qwen3-8b']});
  const readiness=await adapter.probe({profile:'deep'});
  assert.equal(readiness.verified,false);
  assert.equal(readiness.error,'provider_verification_required');
  await assert.rejects(
    adapter.execute({
      route:{profile:'deep',capabilities:['generation']},
      instructions:'private system instructions',
      input:[{role:'user',content:'confidential synthetic placeholder'}],
    }),
    error=>error?.code==='provider_verification_required',
  );
  assert.equal(requests.filter(r=>r.path==='/v1/responses').length,0);
  assert.equal(requests.every(r=>r.body===null),true);
});

test('malformed or unavailable model catalogs cannot verify a private model',async()=>{
  for(const options of [{malformed:true},{modelsStatus:503}]){
    const {adapter,requests}=fakeRuntime(options);
    const probe=await adapter.probe({profile:'balanced'});
    assert.equal(probe.verified,false);
    await assert.rejects(
      adapter.execute({route:{profile:'balanced'},input:[{role:'user',content:'synthetic'}]}),
      error=>['provider_verification_required','provider_unavailable'].includes(error?.code),
    );
    assert.equal(requests.some(r=>r.path==='/v1/responses'),false);
  }
});

test('strict mode rejects actual responses from a different or unidentified model',async()=>{
  for(const returnedId of ['muse-glimmer-30b',null]){
    const {adapter,requests}=fakeRuntime({responseModel:returnedId});
    await assert.rejects(
      adapter.execute({
        route:{profile:'balanced',capabilities:['generation']},
        input:[{role:'user',content:'synthetic only'}],
      }),
      error=>error?.code==='provider_verification_required' && error?.status===503,
    );
    assert.equal(requests.filter(r=>r.path==='/v1/responses').length,1);
    assert.equal(requests.every(r=>r.path!=='/v1/responses'||JSON.parse(r.body).model==='gpt-oss-20b'),true);
  }
});

test('strict dispatch sends only the chosen model to the authenticated runtime',async()=>{
  const {adapter,requests}=fakeRuntime();
  const result=await adapter.execute({
    route:{profile:'balanced',capabilities:['generation']},
    instructions:'Synthetic ATLAS test',
    input:[{role:'user',content:'testing only'}],
  });
  assert.equal(result.model,'gpt-oss-20b');
  assert.equal(result.text,'synthetic-ok');
  assert.deepEqual(requests.map(r=>r.path),['/v1/models','/v1/responses']);
  assert.equal(requests.every(r=>r.auth==='Bearer synthetic-test-only'),true);
  const dispatched=JSON.parse(requests.at(-1).body);
  assert.equal(dispatched.model,'gpt-oss-20b');
  assert.equal(dispatched.store,false);
});

test('private host allowlist blocks unapproved endpoints before any network request',async()=>{
  let sent=false;
  const adapter=createAtlasLocalResponsesAdapter({
    baseUrl:'https://unapproved-model.vendor.example',
    token:'synthetic-test-only',
    models:{deep:'muse-glimmer-30b'},
    verifyModelId:true,
    enforceHostAllowlist:true,
    allowedHosts:['private-ai.atlas.example'],
    fetchFn:async()=>{sent=true;throw new Error('network request must not occur');},
  });
  assert.equal(adapter.descriptor().configured,false);
  assert.equal((await adapter.probe({profile:'deep'})).error,'provider_untrusted_endpoint');
  await assert.rejects(
    adapter.execute({route:{profile:'deep'},input:[{role:'user',content:'synthetic'}]}),
    e=>e?.code==='provider_untrusted_endpoint',
  );
  assert.equal(sent,false);
});

test('allowlist compares exact hostnames rather than suffixes or userinfo',async()=>{
  let sent=false;
  const makeAdapter=url=>createAtlasLocalResponsesAdapter({
    baseUrl:url, token:'synthetic-test-only',models:{deep:'muse-glimmer-30b'},
    enforceHostAllowlist:true,allowedHosts:['private-ai.atlas.example'],
    fetchFn:async()=>{sent=true;throw new Error('should not be called');},
  });
  for(const hostname of ['https://private-ai.atlas.example.evil.example','https://private-ai.atlas.example@evil.example']){
    const adapter=makeAdapter(hostname);
    assert.equal(adapter.descriptor().configured,false);
    assert.equal((await adapter.probe({profile:'deep'})).verified,false);
  }
  assert.equal(sent,false);
});

test('local model requests refuse redirects to prevent credential or prompt forwarding',async()=>{
  const redirects=[];
  const adapter=createAtlasLocalResponsesAdapter({
    baseUrl:'https://private-ai.atlas.example',
    token:'synthetic-test-only',
    models:{deep:'muse-glimmer-30b'},
    verifyModelId:true,enforceHostAllowlist:true,allowedHosts:['private-ai.atlas.example'],
    probeAttempts:1,
    fetchFn:async(url,opts)=>{
      redirects.push(opts?.redirect);
      if(url.endsWith('/health'))return new Response('{}',{status:200});
      if(url.endsWith('/v1/models'))return new Response(JSON.stringify({data:[{id:'muse-glimmer-30b'}]}),{status:200});
      return new Response(JSON.stringify({output:[{content:[{type:'output_text',text:'ok'}]}]}),{status:200});
    },
  });
  assert.equal((await adapter.probe({profile:'deep'})).verified,true);
  await adapter.execute({route:{profile:'deep'},input:[{role:'user',content:'synthetic'}]});
  assert.deepEqual(redirects,['error','error','error','error']);
});

test('strict mode does not claim readiness for an unconfigured runtime',async()=>{
  let sent=false;
  const adapter=createAtlasLocalResponsesAdapter({
    baseUrl:'https://private-ai.atlas.example',
    models:{deep:'muse-glimmer-30b'},
    verifyModelId:true,
    fetchFn:async()=>{sent=true;throw Error('must not send');},
  });
  const probe=await adapter.probe({profile:'deep'});
  assert.equal(probe.configured,false);
  assert.equal(probe.verified,false);
  assert.equal(sent,false);
});
