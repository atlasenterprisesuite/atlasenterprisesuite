import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CloudSubnav } from './AtlasCloudNextLevel';

const OBSERVABILITY_URL =
  'https://ggmanzcgtlrvqfoccgsh.supabase.co/functions/v1/atlas-observability';
const RELEASE_URL =
  'https://ggmanzcgtlrvqfoccgsh.supabase.co/functions/v1/atlas-release-control';

type Evidence = { status?: string; created_at?: string };
type ObservabilityPayload = {
  observability?: {
    posture?: string;
    checkedAt?: string;
    latest_verifications?: Record<string, Evidence>;
  };
};
type ReleaseRow = {
  id: string;
  channel: string;
  status: string;
  source_ref: string | null;
  updated_at: string;
  promoted_at: string | null;
};

const checks = [
  ['CodeQL','Security scanning',true,['codeql','github-security-baseline']],
  ['Cloudflare Workers Build','Build & infrastructure',true,['cloudflare-workers','workers-build','cloudflare-build']],
  ['Validate Deploy Verify','Deployment validation',true,['validate-deploy-verify','production-http','production-route']],
  ['Build Readiness','Release readiness',true,['build-readiness','verify-build-readiness']],
  ['ATLAS Local Runtime Verification','Runtime environment',true,['atlas-local-runtime-verification','local-runtime-verification']],
  ['Global Production Verification','Global availability',true,['global-production-verification','verify-production']],
  ['Exact-SHA Production Verification','Integrity verification',true,['exact-sha-production-verification','production_commit_sha_verified','production-commit-sha']],
  ['HubSpot Live Verification','External integration',false,['hubspot-live','atlas-hubspot-live-verify','hubspot']]
] as const;

function headers() {
  const token = localStorage.getItem('atlas_access_token') || '';
  const orgId = localStorage.getItem('atlas_org_id') || '';
  const value: Record<string,string> = {};
  if (token) value.Authorization = `Bearer ${token}`;
  if (orgId) value['x-atlas-org-id'] = orgId;
  return value;
}
async function getJson<T>(url:string):Promise<T>{
  const response=await fetch(url,{cache:'no-store',headers:headers()});
  const body=await response.json().catch(()=>({error:'invalid_response'}));
  if(!response.ok) throw new Error(String(body?.error || `request_failed_${response.status}`));
  return body as T;
}
function normalize(value?:string){
  const status=String(value||'').toLowerCase();
  if(['success','passed','verified','completed','green'].includes(status)) return 'passed';
  if(['failure','failed','blocked','error','red'].includes(status)) return 'failed';
  if(['pending','queued','running','in_progress','verifying'].includes(status)) return 'pending';
  return 'unknown';
}
function resolveEvidence(map:Record<string,Evidence>,aliases:readonly string[]){
  for(const alias of aliases){
    const hit=Object.entries(map).find(([key])=>{
      const k=key.toLowerCase(), a=alias.toLowerCase();
      return k===a || k.includes(a) || a.includes(k);
    });
    if(hit) return {source:hit[0],state:normalize(hit[1]?.status),createdAt:hit[1]?.created_at};
  }
  return {source:'Evidence not visible',state:'unknown',createdAt:undefined};
}
function sourceSha(value?:string|null){
  const match=String(value||'').match(/\b[a-f0-9]{40}\b/i);
  return match?.[0] || value || 'Not recorded';
}

export function AtlasCloudProductionVerification(){
  const [obs,setObs]=useState<ObservabilityPayload|null>(null);
  const [releases,setReleases]=useState<ReleaseRow[]|null>(null);
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(false);

  async function load(){
    setLoading(true); setError('');
    try{
      const [o,r]=await Promise.all([
        getJson<ObservabilityPayload>(`${OBSERVABILITY_URL}?api=cloud-observability`),
        getJson<{releases:ReleaseRow[]}>(`${RELEASE_URL}?api=releases`)
      ]);
      setObs(o); setReleases(r.releases||[]);
    }catch(reason){
      setError(reason instanceof Error ? reason.message : 'production_verification_unavailable');
    }finally{ setLoading(false); }
  }
  useEffect(()=>{ void load(); },[]);

  const evidence=obs?.observability?.latest_verifications || {};
  const resolved=useMemo(()=>checks.map(([label,detail,required,aliases])=>({
    label,detail,required,...resolveEvidence(evidence,aliases)
  })),[evidence]);

  const latestProduction=useMemo(()=>[...(releases||[])]
    .filter(row=>row.channel==='production')
    .sort((a,b)=>new Date(b.promoted_at||b.updated_at).getTime()-new Date(a.promoted_at||a.updated_at).getTime())[0]||null,[releases]);

  const required=resolved.filter(item=>item.required);
  const anyFailed=required.some(item=>item.state==='failed');
  const allPassed=required.length>0 && required.every(item=>item.state==='passed');
  const badge=anyFailed?'NOT PRODUCTION VERIFIED':allPassed?'FINAL PRODUCTION VERIFIED — FULL':'VERIFICATION HOLD';
  const tone=anyFailed?'failed':allPassed?'passed':'pending';

  return <section className="atlas-cloud-page atlas-cloud-control-page atlas-production-verification">
    <CloudSubnav />
    <header className="atlas-production-hero">
      <div>
        <p className="eyebrow">ATLAS Enterprise Suite · Production Integrity</p>
        <h1>Security & Production Verification</h1>
        <p>Live evidence from ATLAS Observability and Release Control. No screenshot, prior green run or design reference can independently produce a production badge.</p>
      </div>
      <div className={`atlas-production-badge ${tone}`}>
        <span>Production status</span><strong>{badge}</strong>
        <small>{obs?.observability?.posture || 'control-plane posture unavailable'}</small>
      </div>
    </header>

    {error?<div className="atlas-cloud-state error" role="alert"><strong>Verification unavailable</strong><span>{error}</span></div>:null}

    <section className="atlas-production-release-card">
      <div><span>Repository / project</span><strong>atlasenterprisesuite/atlasenterprisesuite</strong></div>
      <div><span>Production source</span><code>{sourceSha(latestProduction?.source_ref)}</code></div>
      <div><span>Release state</span><strong>{latestProduction?.status || 'Not visible'}</strong></div>
      <div><span>Evidence checked</span><strong>{obs?.observability?.checkedAt || 'Not available'}</strong></div>
    </section>

    <section className="atlas-production-check-grid" aria-label="Production verification gates">
      {resolved.map(item=><article className={`atlas-production-check ${item.state}`} key={item.label}>
        <div className="atlas-production-check-icon">{item.state==='passed'?'✓':item.state==='failed'?'×':'•'}</div>
        <div><span>{item.required?'Mandatory gate':'External / optional evidence'}</span><strong>{item.label}</strong><p>{item.detail}</p><small>{item.source}{item.createdAt?` · ${item.createdAt}`:''}</small></div>
        <b>{item.state==='passed'?'Passed':item.state==='failed'?'Failed':'Evidence needed'}</b>
      </article>)}
    </section>

    <section className="atlas-production-advisory">
      <div>!</div><div><strong>External provider checks stay separate from ATLAS-owned integrity.</strong><p>GitHub AI Scan or another managed-provider job remains informational unless the production contract explicitly marks it mandatory.</p></div><span>Fail-closed truth</span>
    </section>

    <div className="atlas-cloud-action-row">
      <button type="button" onClick={()=>void load()} disabled={loading}>{loading?'Refreshing…':'Refresh production evidence'}</button>
      <Link to="/cloud/observability">Open Observability</Link>
      <Link to="/cloud/releases">Open Release Center</Link>
      <Link to="/execution/manager/readiness">Open Manager Readiness</Link>
    </div>

    <p className="atlas-cloud-truth-note">The approved poster supplies visual direction only. Current status values are derived from machine-verifiable control-plane evidence and fail closed when required evidence is missing.</p>
  </section>;
}
