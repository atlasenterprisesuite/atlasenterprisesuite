import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CloudSubnav } from './AtlasCloudNextLevel';

const OBSERVABILITY_URL = 'https://ggmanzcgtlrvqfoccgsh.supabase.co/functions/v1/atlas-observability';
const RELEASE_URL = 'https://ggmanzcgtlrvqfoccgsh.supabase.co/functions/v1/atlas-release-control';

type Evidence = { status?: string; created_at?: string };
type ObservabilityPayload = { ok: boolean; observability?: { posture?: string; latest_verifications?: Record<string, Evidence>; checkedAt?: string } };
type ReleaseRow = { id: string; channel: string; status: string; source_ref: string | null; updated_at: string; promoted_at: string | null };
type Gate = { id: string; label: string; detail: string; required: boolean; aliases: string[] };

const GATES: Gate[] = [
  { id:'codeql', label:'CodeQL', detail:'GitHub security scanning', required:true, aliases:['codeql','github-security-baseline'] },
  { id:'workers', label:'Cloudflare Workers Build', detail:'Build & infrastructure', required:true, aliases:['cloudflare-workers','workers-build','cloudflare-build'] },
  { id:'deploy', label:'Validate Deploy Verify', detail:'Deployment validation', required:true, aliases:['validate-deploy-verify','production-route-verification','production-http'] },
  { id:'readiness', label:'Build Readiness', detail:'Release readiness', required:true, aliases:['build-readiness','verify-build-readiness'] },
  { id:'runtime', label:'ATLAS Local Runtime Verification', detail:'Runtime environment', required:true, aliases:['atlas-local-runtime-verification','local-runtime-verification'] },
  { id:'global', label:'Global Production Verification', detail:'Global availability', required:true, aliases:['global-production-verification','verify-production'] },
  { id:'sha', label:'Exact-SHA Production Verification', detail:'Integrity verification', required:true, aliases:['exact-sha-production-verification','production-commit-sha','production_commit_sha_verified'] },
  { id:'hubspot', label:'HubSpot Live Verification', detail:'Third-party integration', required:false, aliases:['hubspot-live','atlas-hubspot-live-verify','hubspot'] }
];

function headers() {
  const token=localStorage.getItem('atlas_access_token')||'';
  const orgId=localStorage.getItem('atlas_org_id')||'';
  const result:Record<string,string>={};
  if(token) result.Authorization=`Bearer ${token}`;
  if(orgId) result['x-atlas-org-id']=orgId;
  return result;
}

async function getJson<T>(url:string):Promise<T>{
  const response=await fetch(url,{method:'GET',cache:'no-store',headers:headers()});
  const body=await response.json().catch(()=>({error:'invalid_response'}));
  if(!response.ok) throw new Error(String(body?.error||`request_failed_${response.status}`));
  return body as T;
}

function normalize(status?:string){
  const value=String(status||'').trim().toLowerCase();
  if(['passed','success','verified','completed','green'].includes(value)) return 'passed';
  if(['failed','failure','blocked','error','red'].includes(value)) return 'failed';
  if(['running','in_progress','verifying','pending','queued'].includes(value)) return 'pending';
  return 'unknown';
}

function resolveEvidence(evidence:Record<string,Evidence>,aliases:string[]){
  const entries=Object.entries(evidence);
  for(const alias of aliases){
    const a=alias.toLowerCase();
    const match=entries.find(([key])=>{const k=key.toLowerCase();return k===a||k.includes(a)||a.includes(k)});
    if(match) return {source:match[0],state:normalize(match[1]?.status),createdAt:match[1]?.created_at};
  }
  return null;
}

function sourceSha(value?:string|null){
  if(!value) return 'Not recorded';
  const match=value.match(/\b[a-f0-9]{40}\b/i);
  return match?.[0]||value;
}

export function AtlasCloudProductionVerification(){
  const [observability,setObservability]=useState<ObservabilityPayload|null>(null);
  const [releases,setReleases]=useState<ReleaseRow[]|null>(null);
  const [error,setError]=useState('');
  const [refreshing,setRefreshing]=useState(false);

  async function load(){
    setRefreshing(true);setError('');
    try{
      const [o,r]=await Promise.all([
        getJson<ObservabilityPayload>(`${OBSERVABILITY_URL}?api=cloud-observability`),
        getJson<{ok:boolean;releases:ReleaseRow[]}>(`${RELEASE_URL}?api=releases`)
      ]);
      setObservability(o);setReleases(r.releases||[]);
    }catch(reason){setError(reason instanceof Error?reason.message:'production_verification_unavailable')}
    finally{setRefreshing(false)}
  }
  useEffect(()=>{void load()},[]);

  const release=useMemo(()=>[...(releases||[])].filter(item=>item.channel==='production').sort((a,b)=>new Date(b.promoted_at||b.updated_at).getTime()-new Date(a.promoted_at||a.updated_at).getTime())[0]||null,[releases]);
  const evidence=observability?.observability?.latest_verifications||{};
  const checks=useMemo(()=>GATES.map(gate=>{const hit=resolveEvidence(evidence,gate.aliases);return {...gate,state:hit?.state||'unknown',source:hit?.source||'Evidence not visible',createdAt:hit?.createdAt}}),[evidence]);
  const mandatory=checks.filter(check=>check.required);
  const failed=mandatory.some(check=>check.state==='failed');
  const passed=mandatory.length>0&&mandatory.every(check=>check.state==='passed');
  const badge=failed?'NOT PRODUCTION VERIFIED':passed?'FINAL PRODUCTION VERIFIED — FULL':'VERIFICATION HOLD';
  const tone=failed?'failed':passed?'passed':'pending';

  return <section className="atlas-cloud-page atlas-cloud-control-page atlas-production-verification">
    <CloudSubnav/>
    <header className="atlas-production-hero">
      <div><p className="eyebrow">ATLAS Enterprise Suite · Production Integrity</p><h1>ATLAS Security & Production Verification</h1><p>Live evidence from ATLAS Observability and Release Control. Green is shown only when every mandatory production gate is visible and passed.</p></div>
      <div className={`atlas-production-badge ${tone}`}><span>Production status</span><strong>{badge}</strong><small>{observability?.observability?.posture||'control-plane posture unavailable'}</small></div>
    </header>
    {error?<div className="atlas-cloud-state error" role="alert"><strong>Production verification unavailable</strong><span>{error}</span></div>:null}
    <section className="atlas-production-release-card">
      <div><span>Repository / project</span><strong>atlasenterprisesuite/atlasenterprisesuite</strong></div>
      <div><span>Current production source</span><code>{sourceSha(release?.source_ref)}</code></div>
      <div><span>Release state</span><strong>{release?.status||'Not visible'}</strong></div>
      <div><span>Evidence checked</span><strong>{observability?.observability?.checkedAt||'Not available'}</strong></div>
    </section>
    <section className="atlas-production-check-grid" aria-label="Production verification gates">
      {checks.map(check=><article key={check.id} className={`atlas-production-check ${check.state}`}>
        <div className="atlas-production-check-icon" aria-hidden="true">{check.state==='passed'?'✓':check.state==='failed'?'×':'•'}</div>
        <div><span>{check.required?'Mandatory gate':'External / optional evidence'}</span><strong>{check.label}</strong><p>{check.detail}</p><small>{check.source}{check.createdAt?` · ${check.createdAt}`:''}</small></div>
        <b>{check.state==='passed'?'Passed':check.state==='failed'?'Failed':'Evidence needed'}</b>
      </article>)}
    </section>
    <section className="atlas-production-advisory"><div aria-hidden="true">!</div><div><strong>External checks remain separate from ATLAS-owned production integrity.</strong><p>GitHub AI Scan or another managed-provider check is informational unless the production contract explicitly marks it mandatory.</p></div><span>Fail-closed truth</span></section>
    <div className="atlas-cloud-action-row"><button type="button" onClick={()=>void load()} disabled={refreshing}>{refreshing?'Refreshing…':'Refresh production evidence'}</button><Link to="/cloud/observability">Open Observability</Link><Link to="/cloud/releases">Open Release Center</Link><Link to="/execution/manager/readiness">Open Manager Readiness</Link></div>
    <p className="atlas-cloud-truth-note">The approved ATLAS status artwork defines the visual language only. Production status values are never hard-coded from the image; current truth must come from machine-verifiable evidence.</p>
  </section>;
}
