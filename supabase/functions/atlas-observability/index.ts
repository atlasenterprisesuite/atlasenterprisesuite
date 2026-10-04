import { verifyDnsTxt } from '../../../packages/execution/src/dns-verification.ts';
const U='https://ggmanzcgtlrvqfoccgsh.supabase.co';
const K='sb_publishable_wicVjdsduxa5FAnRW9k0Lw_HxtBW72d';
const SELF='/functions/v1/atlas-observability';
const LIVE='/functions/v1/atlas-live';
const VERSION=2;
const MAX_BODY_BYTES=32*1024;

const ALLOWED_ORIGINS=new Set(['https://atlasenterprisesuite.com','https://www.atlasenterprisesuite.com','http://localhost:5173','http://127.0.0.1:5173',U]);
const SAFE_INCIDENT_FIELDS='id,title,service,module,severity,status,error_code,first_seen_at,last_seen_at,occurrence_count,approval_id,repair_job_id,resolved_at,updated_at';
const SAFE_FORBIDDEN_KEYS=new Set(['metadata','raw_exception','authorization','token','prompt','email','ip','resolution_evidence']);

function cors(req:Request){const o=req.headers.get('origin')||'';return o&&ALLOWED_ORIGINS.has(o)?{'access-control-allow-origin':o,'access-control-allow-headers':'authorization,content-type,apikey,x-atlas-org-id','access-control-allow-methods':'GET,POST,OPTIONS','vary':'Origin'}:{}}
function headers(req:Request,extra:Record<string,string>={}){return {'cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'strict-origin-when-cross-origin',...cors(req),...extra}}
function json(req:Request,data:unknown,status=200){return new Response(JSON.stringify(data),{status,headers:headers(req,{'content-type':'application/json; charset=utf-8'})})}
function fail(code:string,status=400){return Object.assign(new Error(code),{code,status})}
function bearer(req:Request){const raw=req.headers.get('authorization')||'';if(!/^Bearer\s+\S+$/i.test(raw))throw fail('authentication_required',401);return raw}
function uuid(v:string){return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)}
function safeFilter(v:string,max=120){const x=String(v||'').trim().slice(0,max);if(!x)return '';if(!/^[A-Za-z0-9._:/-]+$/.test(x))throw fail('invalid_filter',400);return x}
function cleanText(v:unknown,max:number,required=false){const x=String(v??'').trim().slice(0,max);if(required&&!x)throw fail('required_field_missing',422);return x}
async function readJson(r:Response){const text=await r.text();try{return JSON.parse(text)}catch{return null}}
async function request(path:string,authHeader:string,init:RequestInit={}){const h=new Headers({'apikey':K,'authorization':authHeader,'content-type':'application/json',...(init.headers||{})});const r=await fetch(`${U}${path}`,{...init,headers:h,cache:'no-store'});return {r,data:init.method==='HEAD'?null:await readJson(r)}}

async function context(req:Request){
  const auth=bearer(req);
  const userResp=await request('/auth/v1/user',auth);
  if(!userResp.r.ok||!userResp.data?.id)throw fail('authentication_required',401);
  const userId=String(userResp.data.id);
  const memberResp=await request(`/rest/v1/organization_members?select=org_id,role,status&user_id=eq.${encodeURIComponent(userId)}&status=eq.active`,auth);
  if(!memberResp.r.ok)throw fail('identity_unavailable',502);
  const rows=Array.isArray(memberResp.data)?memberResp.data:[];
  if(!rows.length)throw fail('active_organization_required',403);
  const requested=(req.headers.get('x-atlas-org-id')||'').trim();
  if(requested&&!uuid(requested))throw fail('invalid_organization_id',400);
  const membership=requested?rows.find((r:any)=>String(r.org_id)===requested):rows[0];
  if(!membership)throw fail('organization_membership_required',403);
  return {auth,userId,orgId:String(membership.org_id),role:String(membership.role||'')};
}
async function permission(ctx:any,code:string){const x=await request('/rest/v1/rpc/has_identity_permission',ctx.auth,{method:'POST',body:JSON.stringify({o:ctx.orgId,p:code})});return x.r.ok&&x.data===true}
async function requirePermission(ctx:any,code:string){if(!(await permission(ctx,code)))throw fail('permission_denied',403)}

async function countRows(ctx:any,table:string,filters:string){const x=await request(`/rest/v1/${table}?select=id${filters}`,ctx.auth,{method:'HEAD',headers:{'prefer':'count=exact','range-unit':'items','range':'0-0'}});if(!x.r.ok&&x.r.status!==206)throw fail('storage_unavailable',502);const cr=x.r.headers.get('content-range')||'';const m=cr.match(/\/(\d+|\*)$/);return m&&m[1]!=='*'?Number(m[1]):0}
async function visibleIncidents(ctx:any,query:string){await requirePermission(ctx,'incidents.read');const x=await request(`/rest/v1/atlas_incidents?select=${SAFE_INCIDENT_FIELDS}${query}`,ctx.auth);if(!x.r.ok)throw fail('storage_unavailable',502);return Array.isArray(x.data)?x.data:[]}

async function summary(ctx:any){
  await requirePermission(ctx,'observability.read');
  await requirePermission(ctx,'incidents.read');
  const since=new Date(Date.now()-30*60*1000).toISOString();
  const [p0,p1,p2,p3,traces,traceErrors,metrics,verifications]=await Promise.all([
    countRows(ctx,'atlas_incidents','&severity=eq.P0&status=neq.resolved'),
    countRows(ctx,'atlas_incidents','&severity=eq.P1&status=neq.resolved'),
    countRows(ctx,'atlas_incidents','&severity=eq.P2&status=neq.resolved'),
    countRows(ctx,'atlas_incidents','&severity=eq.P3&status=neq.resolved'),
    countRows(ctx,'atlas_trace_spans',`&occurred_at=gte.${encodeURIComponent(since)}`),
    countRows(ctx,'atlas_trace_spans',`&occurred_at=gte.${encodeURIComponent(since)}&status=in.(error,blocked,timeout)`),
    countRows(ctx,'atlas_operational_metrics',`&recorded_at=gte.${encodeURIComponent(since)}`),
    request('/rest/v1/atlas_runtime_verification_runs?select=verification_type,target_service,status,provider_state,error_code,created_at&order=created_at.desc&limit=200',ctx.auth)
  ]);
  const latestByService:Record<string,unknown>={};
  if(verifications.r.ok&&Array.isArray(verifications.data))for(const v of verifications.data){const s=String(v.target_service||'');if(s&&!latestByService[s])latestByService[s]={verification_type:v.verification_type,status:v.status,provider_state:v.provider_state,error_code:v.error_code,created_at:v.created_at}}
  const posture=p0>0?'outage':p1>0?'needs_attention':'operational';
  return {ok:true,service:'atlas-observability',organization_id:ctx.orgId,role:ctx.role,posture,incidents:{P0:p0,P1:p1,P2:p2,P3:p3},telemetry:{window_minutes:30,traces,trace_errors:traceErrors,metrics},latest_verifications:latestByService,checkedAt:new Date().toISOString()};
}

async function incidentList(ctx:any,url:URL){
  const parts=['&order=severity.asc,last_seen_at.desc'];
  const severity=safeFilter(url.searchParams.get('severity')||'',10);if(severity){if(!/^P[0-3]$/.test(severity))throw fail('invalid_severity',400);parts.push(`&severity=eq.${severity}`)}
  const status=safeFilter(url.searchParams.get('status')||'',40);if(status){if(!['detected','triaging','awaiting_approval','mitigating','monitoring','blocked','resolved'].includes(status))throw fail('invalid_status',400);parts.push(`&status=eq.${status}`)}
  const service=safeFilter(url.searchParams.get('service')||'',120);if(service)parts.push(`&service=eq.${encodeURIComponent(service)}`);
  const limit=Math.min(100,Math.max(1,Number(url.searchParams.get('limit')||50)||50));parts.push(`&limit=${limit}`);
  return visibleIncidents(ctx,parts.join(''));
}

async function incidentDetail(ctx:any,id:string){
  if(!uuid(id))throw fail('invalid_incident_id',400);
  const rows=await visibleIncidents(ctx,`&id=eq.${encodeURIComponent(id)}&limit=1`);if(!rows[0])throw fail('incident_not_found',404);
  let timeline:any[]=[];
  if(await permission(ctx,'audit.read')){
    const x=await request(`/rest/v1/audit_logs?select=id,action,created_at,old_data,new_data&table_name=eq.atlas_incidents&record_id=eq.${encodeURIComponent(id)}&order=created_at.desc&limit=100`,ctx.auth);
    if(x.r.ok&&Array.isArray(x.data))timeline=x.data.map((r:any)=>({occurred_at:r.created_at,event_type:r.action,before:r.old_data?{status:r.old_data.status,severity:r.old_data.severity,error_code:r.old_data.error_code}:null,after:r.new_data?{status:r.new_data.status,severity:r.new_data.severity,error_code:r.new_data.error_code}:null}));
  }
  return {ok:true,incident:rows[0],timeline};
}


function validHostname(value:string){
  const hostname=String(value||'').trim().toLowerCase();
  if(!hostname||hostname.length>253)throw fail('invalid_hostname',400);
  if(!/^(?=.{1,253}$)(?:_?[a-z0-9](?:[a-z0-9_-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(hostname))throw fail('invalid_hostname',400);
  return hostname;
}

async function cloudDomainVerify(ctx:any,url:URL){
  await requirePermission(ctx,'projects.read');
  const hostname=validHostname(url.searchParams.get('hostname')||'');
  const expected=String(url.searchParams.get('expected')||'').trim();
  if(!expected||expected.length>2048)throw fail('invalid_expected_value',400);

  let response:Response;
  try{
    response=await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(hostname)}&type=TXT`,{
      headers:{accept:'application/dns-json'},
      cache:'no-store'
    });
  }catch{
    throw fail('dns_resolver_unavailable',502);
  }
  if(!response.ok)throw fail('dns_resolver_unavailable',502);

  const payload=await response.json().catch(()=>null);
  if(!payload)throw fail('dns_resolver_unavailable',502);
  const rawAnswers=Array.isArray(payload?.Answer)
    ? payload.Answer
        .filter((answer:any)=>Number(answer?.type)===16&&typeof answer?.data==='string')
        .map((answer:any)=>String(answer.data))
    : [];
  const verification=verifyDnsTxt(expected,rawAnswers);

  return {
    ok:true,
    organization_id:ctx.orgId,
    hostname,
    record_type:'TXT',
    verified:verification.verified,
    answers:verification.answers,
    authority:'public DNS via Cloudflare DNS-over-HTTPS',
    mutation_capability:'blocked_without_authorized_adapter',
    checkedAt:new Date().toISOString()
  };
}

function cloudOpenApi(){
  return {
    openapi:'3.1.0',
    info:{title:'ATLAS Cloud Control API',version:'2',description:'Authenticated organization-scoped control API reusing ATLAS Observability, Projects and the canonical service registry.'},
    servers:[{url:SELF}],
    paths:{
      '/?api=cloud-resources':{get:{summary:'List organization projects and registered ATLAS services',security:[{atlasBearer:[]}],responses:{'200':{description:'Resource inventory'}}}},
      '/?api=cloud-project&id={projectId}':{get:{summary:'Read one project with tasks and milestones',security:[{atlasBearer:[]}],responses:{'200':{description:'Project detail'}}}},
      '/?api=cloud-observability':{get:{summary:'Read the native ATLAS observability summary',security:[{atlasBearer:[]}],responses:{'200':{description:'Sanitized observability summary'}}}},
      '/?api=cloud-domain-verify&hostname={hostname}&expected={txtValue}':{get:{summary:'Verify public TXT DNS evidence without provider mutation',security:[{atlasBearer:[]}],responses:{'200':{description:'DNS verification evidence'},'502':{description:'Public resolver unavailable'}}}},
      '/?api=cloud-project-create':{post:{summary:'Create an organization project through projects.write plus RLS',security:[{atlasBearer:[]}],responses:{'201':{description:'Project created'},'403':{description:'Project write permission required'}}}}
    },
    components:{securitySchemes:{atlasBearer:{type:'http',scheme:'bearer',bearerFormat:'JWT'}}}
  };
}

async function cloudResources(ctx:any){
  await requirePermission(ctx,'projects.read');
  const [projects,modules]=await Promise.all([
    request(`/rest/v1/projects?select=id,name,description,status,priority,owner_user_id,start_date,due_date,completed_at,updated_at&org_id=eq.${encodeURIComponent(ctx.orgId)}&order=updated_at.desc&limit=200`,ctx.auth),
    request(`/rest/v1/atlas_module_registry?select=module_code,enabled,launch_status,data_backend,updated_at&org_id=eq.${encodeURIComponent(ctx.orgId)}&order=module_code.asc&limit=300`,ctx.auth)
  ]);
  if(!projects.r.ok)throw fail('projects_unavailable',502);
  if(!modules.r.ok)throw fail('service_registry_unavailable',502);
  return {ok:true,organization_id:ctx.orgId,role:ctx.role,projects:Array.isArray(projects.data)?projects.data:[],services:Array.isArray(modules.data)?modules.data:[],truth:{project_authority:'public.projects',service_authority:'public.atlas_module_registry',duplicated_registry_created:false,control_plane:'atlas-observability'}};
}

async function cloudProject(ctx:any,id:string){
  await requirePermission(ctx,'projects.read');
  if(!uuid(id))throw fail('invalid_project_id',400);
  const [project,tasks,milestones]=await Promise.all([
    request(`/rest/v1/projects?select=id,name,description,status,priority,owner_user_id,start_date,due_date,completed_at,updated_at&org_id=eq.${encodeURIComponent(ctx.orgId)}&id=eq.${encodeURIComponent(id)}&limit=1`,ctx.auth),
    request(`/rest/v1/project_tasks?select=id,title,description,status,priority,assigned_user_id,due_date,completed_at,updated_at&org_id=eq.${encodeURIComponent(ctx.orgId)}&project_id=eq.${encodeURIComponent(id)}&order=updated_at.desc`,ctx.auth),
    request(`/rest/v1/project_milestones?select=id,name,status,due_date,completed_at,updated_at&org_id=eq.${encodeURIComponent(ctx.orgId)}&project_id=eq.${encodeURIComponent(id)}&order=due_date.asc`,ctx.auth)
  ]);
  if(!project.r.ok)throw fail('project_unavailable',502);
  const row=Array.isArray(project.data)?project.data[0]:null;
  if(!row)throw fail('project_not_found',404);
  if(!tasks.r.ok||!milestones.r.ok)throw fail('project_children_unavailable',502);
  return {ok:true,project:row,tasks:Array.isArray(tasks.data)?tasks.data:[],milestones:Array.isArray(milestones.data)?milestones.data:[]};
}

async function cloudProjectCreate(ctx:any,req:Request){
  await requirePermission(ctx,'projects.write');
  const length=Number(req.headers.get('content-length')||'0');
  if(length>MAX_BODY_BYTES)throw fail('payload_too_large',413);
  const body=await req.json().catch(()=>{throw fail('invalid_json',400)});
  const name=cleanText(body?.name,160,true);
  const description=cleanText(body?.description,2000);
  const priority=cleanText(body?.priority||'medium',20);
  if(!['low','medium','high','critical'].includes(priority))throw fail('invalid_priority',422);
  const startDate=cleanText(body?.start_date,10)||null;
  const dueDate=cleanText(body?.due_date,10)||null;
  const created=await request('/rest/v1/projects?select=id,name,description,status,priority,start_date,due_date,updated_at',ctx.auth,{
    method:'POST',
    headers:{prefer:'return=representation'},
    body:JSON.stringify({org_id:ctx.orgId,name,description:description||null,status:'planned',priority,start_date:startDate,due_date:dueDate,created_by:ctx.userId})
  });
  if(!created.r.ok){
    if(created.r.status===401||created.r.status===403)throw fail('project_write_permission_required',403);
    throw fail('project_create_failed',422);
  }
  const row=Array.isArray(created.data)?created.data[0]:created.data;
  return {ok:true,project:row};
}

function page(){return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#020711"><title>ATLAS Observability</title><style>:root{color-scheme:dark;--b:#020711;--p:#071727;--l:#2b8fc055;--c:#54d8ff;--t:#f1f8ff;--m:#91abc0;--ok:#54e3a4;--bad:#ff8395;--warn:#ffd477}*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 80% 0,#0a436866,transparent 30%),var(--b);color:var(--t);font-family:Inter,system-ui,sans-serif}nav{display:flex;gap:14px;padding:13px 18px;border-bottom:1px solid var(--l);background:#020b15ef;position:sticky;top:0}a{color:#d8eaf6;text-decoration:none}.brand{font-weight:900;letter-spacing:.12em}.brand span{color:var(--c)}main{max-width:1360px;margin:auto;padding:18px 12px}.card{border:1px solid var(--l);border-radius:18px;background:linear-gradient(145deg,#081b2d,#03101c);padding:15px;margin-bottom:12px}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.kpi{border:1px solid var(--l);border-radius:13px;padding:12px;background:#03101c}.muted{color:var(--m)}.row{display:flex;gap:8px;flex-wrap:wrap}select,input,button{font:inherit;border:1px solid var(--l);border-radius:9px;padding:9px;background:#03101c;color:white}button{cursor:pointer}.table{overflow:auto}.item{display:grid;grid-template-columns:80px 120px 1fr 150px 170px;gap:8px;padding:10px;border-bottom:1px solid #173047;cursor:pointer}.pill{display:inline-block;border:1px solid var(--l);border-radius:999px;padding:4px 7px;font-size:.75rem}.P0,.P1{color:var(--bad)}.P2{color:var(--warn)}.P3{color:var(--ok)}pre{white-space:pre-wrap;word-break:break-word;background:#020b15;border:1px solid var(--l);border-radius:10px;padding:10px}.hidden{display:none}@media(max-width:850px){.grid{grid-template-columns:1fr 1fr}.item{grid-template-columns:70px 90px 1fr}}@media(max-width:520px){.grid{grid-template-columns:1fr}}</style></head><body><nav><a class="brand" href="${LIVE}#/dashboard">ATLAS <span>OBSERVABILITY</span></a><a href="/functions/v1/atlas-governance">Governance</a><a href="/functions/v1/atlas-auth">Identity</a></nav><main><div class="card"><h1>Observability & Incident Response</h1><p class="muted">Verified incidents, runtime evidence and sanitized telemetry.</p><div id="state" class="muted">Checking ATLAS session…</div></div><div class="grid"><div class="kpi"><span class="muted">Open P0 / P1</span><h2 id="critical">—</h2></div><div class="kpi"><span class="muted">Open P2 / P3</span><h2 id="noncritical">—</h2></div><div class="kpi"><span class="muted">Last verification</span><h2 id="verification">—</h2></div><div class="kpi"><span class="muted">Telemetry 30m</span><h2 id="telemetry">—</h2></div></div><div class="card"><div class="row"><select id="sev"><option value="">All severities</option><option>P0</option><option>P1</option><option>P2</option><option>P3</option></select><select id="stat"><option value="">All statuses</option><option>detected</option><option>triaging</option><option>awaiting_approval</option><option>mitigating</option><option>monitoring</option><option>blocked</option><option>resolved</option></select><input id="svc" placeholder="Service"><button id="refresh">Refresh</button></div></div><div class="card table"><div id="incidents" class="muted">Loading…</div></div><div id="detailCard" class="card hidden"><h2>Incident detail</h2><div id="detail"></div></div></main><script>const SELF=${JSON.stringify(SELF)},LIVE=${JSON.stringify(LIVE)},$=id=>document.getElementById(id),tok=()=>localStorage.atlas_access_token||'',org=()=>localStorage.atlas_org_id||'';function H(){const h={'authorization':'Bearer '+tok()};if(org())h['x-atlas-org-id']=org();return h}const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));async function api(q){const r=await fetch(SELF+'?api='+q,{headers:H(),cache:'no-store'}),d=await r.json();if(!r.ok)throw Error(d.error||'request_failed');return d}async function loadSummary(){const d=await api('summary');state.textContent='Operational observability · '+d.posture;critical.textContent=(d.incidents.P0||0)+' / '+(d.incidents.P1||0);noncritical.textContent=(d.incidents.P2||0)+' / '+(d.incidents.P3||0);const vals=Object.values(d.latest_verifications||{});verification.textContent=vals.length?String(vals[0].status||'unknown'):'—';telemetry.textContent=(d.telemetry.traces||0)+' traces · '+(d.telemetry.metrics||0)+' metrics'}async function loadIncidents(){const q=new URLSearchParams({api:'incidents',limit:'100'});if(sev.value)q.set('severity',sev.value);if(stat.value)q.set('status',stat.value);if(svc.value.trim())q.set('service',svc.value.trim());const r=await fetch(SELF+'?'+q.toString(),{headers:H(),cache:'no-store'}),d=await r.json();if(!r.ok)throw Error(d.error||'request_failed');incidents.innerHTML=(d.incidents||[]).length?d.incidents.map(i=>'<div class="item" data-id="'+esc(i.id)+'"><b class="'+esc(i.severity)+'">'+esc(i.severity)+'</b><span>'+esc(i.status)+'</span><b>'+esc(i.service)+'</b><span>'+esc(i.error_code||'—')+'</span><span>'+esc(i.last_seen_at)+'</span></div>').join(''):'No incidents visible.';document.querySelectorAll('.item').forEach(x=>x.onclick=()=>showDetail(x.dataset.id))}async function showDetail(id){const d=await api('incident&id='+encodeURIComponent(id));detailCard.classList.remove('hidden');detail.innerHTML='<p><b>'+esc(d.incident.severity)+' · '+esc(d.incident.service)+'</b></p><p>'+esc(d.incident.title)+'</p><p class="muted">'+esc(d.incident.status)+' · '+esc(d.incident.error_code||'no error code')+'</p><h3>Timeline</h3>'+(d.timeline||[]).map(x=>'<div><span class="pill">'+esc(x.event_type)+'</span> '+esc(x.occurred_at)+'</div>').join('')}async function load(){if(!tok()){state.innerHTML='Sign in through <a href="'+LIVE+'#/login">ATLAS Live</a> to view operational data.';incidents.textContent='Authentication required.';return}try{await Promise.all([loadSummary(),loadIncidents()])}catch(e){state.textContent=e.message}}refresh.onclick=load;sev.onchange=loadIncidents;stat.onchange=loadIncidents;svc.onchange=loadIncidents;load();</script></body></html>`}

Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:headers(req)});
  const url=new URL(req.url),api=url.searchParams.get('api');
  try{
    if(api==='readiness')return json(req,{ok:true,service:'atlas-observability',version:VERSION,state:'ready',incidents:true,traces:true,metrics:true,cloud_control:true,checkedAt:new Date().toISOString()});
    if(!api)return new Response(page(),{headers:headers(req,{'content-type':'text/html; charset=utf-8','content-security-policy':`default-src 'self'; connect-src ${U}; style-src 'unsafe-inline'; script-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'`})});
    const ctx=await context(req);
    if(req.method==='GET'&&api==='cloud-openapi')return json(req,cloudOpenApi());
    if(req.method==='GET'&&api==='cloud-resources')return json(req,await cloudResources(ctx));
    if(req.method==='GET'&&api==='cloud-project')return json(req,await cloudProject(ctx,String(url.searchParams.get('id')||'')));
    if(req.method==='GET'&&api==='cloud-observability')return json(req,{ok:true,observability:await summary(ctx)});
    if(req.method==='GET'&&api==='cloud-domain-verify')return json(req,await cloudDomainVerify(ctx,url));
    if(req.method==='POST'&&api==='cloud-project-create')return json(req,await cloudProjectCreate(ctx,req),201);
    if(req.method!=='GET')return json(req,{ok:false,error:'method_not_allowed'},405);
    if(api==='summary')return json(req,await summary(ctx));
    if(api==='incidents')return json(req,{ok:true,incidents:await incidentList(ctx,url)});
    if(api==='incident')return json(req,await incidentDetail(ctx,String(url.searchParams.get('id')||'')));
    return json(req,{ok:false,error:'not_found'},404);
  }catch(error:any){const code=String(error?.code||error?.message||'internal_error');const status=Number(error?.status)||500;return json(req,{ok:false,error:SAFE_FORBIDDEN_KEYS.has(code)?'request_failed':code},status)}
});