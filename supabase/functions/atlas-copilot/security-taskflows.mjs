export const SECURITY_TASKFLOW_CLASSES=Object.freeze([
  'auth_session',
  'tenant_isolation',
  'ssrf_url_handling',
  'injection_unsafe_parsing',
  'webhook_signature_replay',
  'ci_trust_boundary',
  'secret_unsafe_logging',
]);

export const SECURITY_EVIDENCE_KINDS=Object.freeze([
  'failing_test',
  'static_analysis',
  'reproducible_http',
  'sandbox_proof',
]);

function clean(value){return typeof value==='string'&&value.trim()?value.trim():null;}
function cloneSafe(value){return value&&typeof value==='object'?structuredClone(value):{};}
function fail(code,status=400,details={}){return Object.assign(new Error(code),{code,status,...details});}

export function normalizeSecurityFinding(input={}){
  const organization_id=clean(input.organization_id),trace_id=clean(input.trace_id),taskflow_class=clean(input.taskflow_class);
  if(!organization_id)throw fail('organization_id_required');
  if(!trace_id)throw fail('trace_id_required');
  if(!SECURITY_TASKFLOW_CLASSES.includes(taskflow_class))throw fail('security_taskflow_class_invalid',400,{taskflow_class});
  const title=clean(input.title);
  if(!title)throw fail('security_finding_title_required');
  return Object.freeze({
    finding_id:clean(input.finding_id)||`atlas-security-${trace_id}-${taskflow_class}`,
    organization_id,
    trace_id,
    taskflow_class,
    title,
    severity:clean(input.severity)?.toLowerCase()||'unclassified',
    description:clean(input.description),
    state:'hypothesis',
    verification:Object.freeze({verified:false,reason:'reproducible_evidence_required',evidence:null}),
  });
}

export function verifySecurityFinding({finding,evidence}={}){
  const base=cloneSafe(finding);
  if(base.state==='dismissed')return Object.freeze(base);
  const kind=clean(evidence?.kind),reference=clean(evidence?.reference);
  if(!SECURITY_EVIDENCE_KINDS.includes(kind)){
    return Object.freeze({...base,state:'hypothesis',verification:{verified:false,reason:'unsupported_evidence_kind',evidence:null}});
  }
  if(clean(evidence?.organization_id)!==clean(base.organization_id)||clean(evidence?.trace_id)!==clean(base.trace_id)){
    return Object.freeze({...base,state:'hypothesis',verification:{verified:false,reason:'evidence_scope_mismatch',evidence:null}});
  }
  if(!reference){
    return Object.freeze({...base,state:'hypothesis',verification:{verified:false,reason:'evidence_reference_required',evidence:null}});
  }
  return Object.freeze({
    ...base,
    state:'verified',
    verification:Object.freeze({
      verified:true,
      reason:'reproducible_evidence',
      evidence:Object.freeze({kind,reference}),
    }),
  });
}
