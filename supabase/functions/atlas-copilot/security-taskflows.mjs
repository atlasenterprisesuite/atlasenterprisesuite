function freezeStep(id,purpose){return Object.freeze({id,purpose});}
const AUTHORIZED_CODE_AUDIT_V1=Object.freeze({
  id:'authorized-code-audit',
  version:'v1',
  scope:'authorized-code-only',
  steps:Object.freeze([
    freezeStep('recon','Establish authorized target scope and repository context.'),
    freezeStep('hypothesis','Form bounded security hypotheses from observable evidence.'),
    freezeStep('code_search','Locate relevant implementation paths without bypassing access controls.'),
    freezeStep('vulnerability_analysis','Analyze candidate weaknesses and affected trust boundaries.'),
    freezeStep('exploitability_check','Assess exploitability without performing unauthorized external exploitation.'),
    freezeStep('evidence','Capture reproducible evidence, provenance and confidence.'),
    freezeStep('remediation','Produce the smallest safe remediation proposal.'),
    freezeStep('regression_test','Verify the remediation against a regression test and original evidence.'),
  ]),
});

export const SECURITY_TASKFLOWS=Object.freeze({
  'authorized-code-audit':Object.freeze({v1:AUTHORIZED_CODE_AUDIT_V1}),
});

export function getSecurityTaskflow(id,version){
  const flow=SECURITY_TASKFLOWS[id]?.[version];
  if(!flow)throw Object.assign(new Error('taskflow_not_found'),{code:'taskflow_not_found',status:404,id,version});
  return flow;
}

export function createSecurityExecutionPlan({id,version,target}={}){
  const flow=getSecurityTaskflow(id,version);
  if(typeof target!=='string'||!target.trim())throw Object.assign(new Error('invalid_input'),{code:'invalid_input',status:400,field:'target'});
  return Object.freeze({id:flow.id,version:flow.version,target:target.trim(),scope:flow.scope,steps:Object.freeze(flow.steps.map((step,index)=>Object.freeze({sequence:index+1,id:step.id,purpose:step.purpose,status:'pending'})))});
}
