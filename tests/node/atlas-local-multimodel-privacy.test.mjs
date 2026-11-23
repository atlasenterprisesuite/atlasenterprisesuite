import test from 'node:test';
import assert from 'node:assert/strict';
import { createAtlasLocalResponsesAdapter } from '../../supabase/functions/atlas-copilot/atlas-local-responses-adapter.mjs';

const models = {
  fast: 'qwen3-8b',
  balanced: 'gpt-oss-20b',
  deep: 'muse-glimmer-30b',
};

function fakeRuntime({advertised=Object.values(models),modelsStatus=200,malformed=false}={}){
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
      id:'local-response',model:JSON.parse(options.body).model,
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
