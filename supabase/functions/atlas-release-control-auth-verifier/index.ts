import { createClient } from 'npm:@supabase/supabase-js@2.95.0';

const U=Deno.env.get('SUPABASE_URL')||'https://ggmanzcgtlrvqfoccgsh.supabase.co';
const K=Deno.env.get('SUPABASE_ANON_KEY')||'sb_publishable_wicVjdsduxa5FAnRW9k0Lw_HxtBW72d';
const SERVICE=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
const RC=`${U}/functions/v1/atlas-release-control`;
const E2E_EMAIL='atlas-release-control-e2e@atlas.invalid';
const E2E_ORG='ATLAS Release Control E2E';
const VERSION=3;

function json(data:unknown,status=200){return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer'}})}
function fail(code:string,status=500){return Object.assign(new Error(code),{code,status})}
function randomPassword(){const b=new Uint8Array(36);crypto.getRandomValues(b);return [...b].map(x=>x.toString(16).padStart(2,'0')).join('')}
function safeDetail(v:unknown){return String(v??'').slice(0,500).replace(/Bearer\s+\S+/gi,'Bearer [REDACTED]').replace(/(?:sk-|sb_secret_)\S+/gi,'[REDACTED]')}
function forbidden(v:unknown){const s=JSON.stringify(v??{}).toLowerCase();return ['"metadata"','"authorization"','"token"','"password"','"provider_payload"','"raw_exception"','"notes"'].some(k=>s.includes(k))}
async function body(r:Response){const t=await r.text();try{return JSON.parse(t)}catch{return {raw:t.slice(0,300)}}}
async function http(url:string,init:RequestInit={}){const r=await fetch(url,{...init,cache:'no-store'});return {r,data:await body(r)}}
if(!SERVICE)throw new Error('SUPABASE_SERVICE_ROLE_KEY missing');
const admin=createClient(U,SERVICE,{auth:{autoRefreshToken:false,persistSession:false}});

async function authorize(req:Request){const token=(req.headers.get('x-atlas-runtime-verifier-token')||'').trim();if(!token)throw fail('authentication_required',401);const {data,error}=await admin.rpc('atlas_verify_runtime_invocation',{p_token:token});if(error||data!==true)throw fail('permission_denied',403)}
async function prepareIdentity(){
  const listed=await admin.auth.admin.listUsers({page:1,perPage:1000});if(listed.error)throw fail('identity_admin_failed',502);
  const password=randomPassword();let user=listed.data.users.find(u=>String(u.email||'').toLowerCase()===E2E_EMAIL);
  if(user){const u=await admin.auth.admin.updateUserById(user.id,{password,email_confirm:true,user_metadata:{full_name:'ATLAS Release Control E2E',purpose:'non-destructive-production-e2e'}});if(u.error||!u.data.user)throw fail('identity_admin_failed',502);user=u.data.user}
  else{const c=await admin.auth.admin.createUser({email:E2E_EMAIL,password,email_confirm:true,user_metadata:{full_name:'ATLAS Release Control E2E',purpose:'non-destructive-production-e2e'}});if(c.error||!c.data.user)throw fail('identity_admin_failed',502);user=c.data.user}
  await admin.from('profiles').upsert({id:user.id,full_name:'ATLAS Release Control E2E'},{onConflict:'id'});
  const q=await admin.from('organizations').select('id').eq('name',E2E_ORG).limit(1);if(q.error)throw fail('storage_unavailable',502);
  let orgId=q.data?.[0]?.id as string|undefined;if(!orgId){const c=await admin.from('organizations').insert({name:E2E_ORG,legal_name:'ATLAS Release Control E2E LLC',industry:'Quality Assurance / AI Verification',active:true,created_by:user.id}).select('id').single();if(c.error||!c.data?.id)throw fail('storage_unavailable',502);orgId=c.data.id}
  const m=await admin.from('organization_members').upsert({org_id:orgId,user_id:user.id,role:'owner',status:'active'},{onConflict:'org_id,user_id'});if(m.error)throw fail('storage_unavailable',502);
  return {orgId,userId:user.id,password};
}
async function signIn(password:string){const x=await http(`${U}/auth/v1/token?grant_type=password`,{method:'POST',headers:{apikey:K,'content-type':'application/json'},body:JSON.stringify({email:E2E_EMAIL,password})});if(x.r.status!==200||!x.data?.access_token)throw fail('authentication_failed',401);return String(x.data.access_token)}
function h(access:string,orgId:string){return {'authorization':`Bearer ${access}`,'x-atlas-org-id':orgId,'content-type':'application/json'}}
async function get(api:string,access:string,orgId:string){return http(`${RC}?api=${api}`,{headers:h(access,orgId)})}
async function post(api:string,access:string,orgId:string,payload:unknown){return http(`${RC}?api=${api}`,{method:'POST',headers:h(access,orgId),body:JSON.stringify(payload)})}

async function run(){
  const started=Date.now();const checks:Record<string,unknown>={};let orgId:string|null=null;let userId:string|null=null;let syntheticRelease:string|null=null;let status='failed';let errorCode:string|null=null;
  try{
    const identity=await prepareIdentity();orgId=identity.orgId;userId=identity.userId;checks.identity_prepared=true;
    const access=await signIn(identity.password);checks.password_authentication=true;
    const perm=await http(`${U}/rest/v1/rpc/has_identity_permission`,{method:'POST',headers:{apikey:K,authorization:`Bearer ${access}`,'content-type':'application/json'},body:JSON.stringify({o:orgId,p:'releases.read'})});
    checks.releases_read_permission=perm.r.ok&&perm.data===true;if(!checks.releases_read_permission)throw fail('permission_contract_failed',403);

    const list=await get('releases',access,orgId);checks.releases_200=list.r.status===200&&list.data?.ok===true&&Array.isArray(list.data?.releases);checks.releases_sanitized=!forbidden(list.data);if(!checks.releases_200||!checks.releases_sanitized)throw fail('release_list_contract_failed',500);

    const key=`release-control-e2e-${crypto.randomUUID()}`;
    const create=await post('release-create',access,orgId,{release_key:key,version:'e2e.1',channel:'development',source_ref:'supabase-native:e2e',components:[{component_type:'edge_function',component_key:'e2e-release-control',artifact_ref:'e2e',artifact_sha256:'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',target_version:'1',provider:'atlas-native',deployment_order:100,rollback_strategy:'redeploy_previous',rollback_ref:'e2e-prev',requires_migration:false,metadata:{change_class:'e2e'}}]});
    checks.create_201=create.r.status===201&&create.data?.ok===true&&typeof create.data?.release_id==='string';if(!checks.create_201)throw fail('release_create_contract_failed',500);syntheticRelease=String(create.data.release_id);
    const detail=await get(`release&id=${encodeURIComponent(syntheticRelease)}`,access,orgId);checks.detail_200=detail.r.status===200&&detail.data?.ok===true&&detail.data?.release?.id===syntheticRelease;checks.detail_sanitized=!forbidden(detail.data);if(!checks.detail_200||!checks.detail_sanitized)throw fail('release_detail_contract_failed',500);

    const base=await admin.from('atlas_releases').select('id').is('org_id',null).eq('channel','production').eq('status','promoted').limit(1);const baselineId=base.data?.[0]?.id?String(base.data[0].id):'';
    const platform=baselineId?await get(`release&id=${encodeURIComponent(baselineId)}`,access,orgId):null;checks.platform_release_hidden=Boolean(platform&&platform.r.status===404);
    const foreign=await get('releases',access,crypto.randomUUID());checks.cross_tenant_denied=foreign.r.status===403;
    if(!checks.platform_release_hidden||!checks.cross_tenant_denied)throw fail('tenant_boundary_failed',500);

    await admin.from('organization_members').update({role:'manager'}).eq('org_id',orgId).eq('user_id',userId);
    const deniedPromote=await post('deployment-promote',access,orgId,{id:crypto.randomUUID()});
    const deniedRollback=await post('deployment-rollback',access,orgId,{id:crypto.randomUUID(),reason:'e2e'});
    checks.manager_promote_denied=deniedPromote.r.status===403;checks.manager_rollback_denied=deniedRollback.r.status===403;
    await admin.from('organization_members').update({role:'owner'}).eq('org_id',orgId).eq('user_id',userId);
    if(!checks.manager_promote_denied||!checks.manager_rollback_denied)throw fail('manager_permission_boundary_failed',500);

    checks.contains_personal_data=false;status='passed';
  }catch(e:any){errorCode=String(e?.code||'release_control_auth_contract_failed');checks.failure=errorCode}
  finally{
    if(orgId&&userId)await admin.from('organization_members').update({role:'owner'}).eq('org_id',orgId).eq('user_id',userId);
    if(syntheticRelease)await admin.from('atlas_releases').delete().eq('id',syntheticRelease).eq('status','draft');
  }
  const completed=new Date().toISOString();
  const row={verification_type:'release-control-auth-contract',target_service:'atlas-release-control',target_version:'2',environment:'production',status,started_at:new Date(started).toISOString(),completed_at:completed,duration_ms:Math.max(0,Date.now()-started),provider:'supabase-auth',provider_state:status==='passed'?'verified':'failed',storage_state:'configured',organization_id:orgId,checks,metadata:{verifier_version:VERSION,contains_personal_data:false,source:'supabase-native-edge-e2e'},error_code:errorCode,error_detail:errorCode?safeDetail(errorCode):null};
  const ins=await admin.from('atlas_runtime_verification_runs').insert(row).select('id').single();if(ins.error)throw fail('verification_persistence_failed',502);
  return {ok:status==='passed',run_id:ins.data.id,status,checks,error_code:errorCode};
}

Deno.serve(async(req:Request)=>{const u=new URL(req.url),api=u.searchParams.get('api');if(req.method==='GET'&&api==='readiness')return json({ok:true,service:'atlas-release-control-auth-verifier',version:VERSION,state:'ready',auth:'vault-backed-custom-token',stores_credentials:false});if(req.method==='POST'&&api==='verify'){try{await authorize(req);const result=await run();return json(result,result.ok?200:500)}catch(e:any){return json({ok:false,error:String(e?.code||'verifier_internal_error')},Number(e?.status)||500)}}return json({ok:false,error:'not_found'},404)});
