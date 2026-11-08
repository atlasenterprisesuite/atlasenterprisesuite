import { authorizedAtlasFetch, getActiveAtlasOrganization } from '../../lib/atlasSession';

export type CareParticipant={
  id:string; org_id:string; display_name:string; eligibility_status:'pending'|'eligible'|'ineligible'|'review';
  eligibility_source:string; eligibility_verified_at:string|null;
};
export type Caregiver={
  id:string; org_id:string; worker_id:string|null; full_name:string;
  authorization_status:'pending'|'authorized'|'suspended';
  certification_status:'pending'|'verified'|'expired'; certification_expires_on:string|null; active:boolean;
};
export type CarePlan={
  id:string; org_id:string; participant_id:string; caregiver_id:string; name:string; start_date:string; end_date:string|null;
  authorized_minutes_per_week:number; status:'draft'|'active'|'paused'|'closed';
};
export type CareTimeEntry={
  id:string; org_id:string; plan_id:string; participant_id:string; caregiver_id:string; work_date:string;
  started_at:string; ended_at:string; minutes:number; status:'draft'|'submitted'|'approved'|'rejected';
  payroll_ready:boolean; rejection_reason:string|null;
};
export type CareCapabilityState={status:'ready'|'blocked';reason:string};
export type CareCapabilityReadiness={
  as_of:string;
  capabilities:{payer_eligibility:CareCapabilityState;ehr_exchange:CareCapabilityState;payroll_handoff:CareCapabilityState};
};
export type CareWorkspace={
  organizationId:string;
  participants:CareParticipant[];
  caregivers:Caregiver[];
  plans:CarePlan[];
  timeEntries:CareTimeEntry[];
  readiness:CareCapabilityReadiness;
};

async function parse<T>(response:Response):Promise<T>{
  const text=await response.text();
  let body:unknown=null;
  try{body=text?JSON.parse(text):null}catch{body=text}
  if(!response.ok){
    const message=body&&typeof body==='object'&&'message' in body
      ?String((body as {message?:unknown}).message||'care_request_failed')
      :typeof body==='string'&&body?body:`care_request_failed_${response.status}`;
    throw new Error(message);
  }
  return body as T;
}

const q=(org:string)=>encodeURIComponent(`eq.${org}`);

async function loadReadiness(orgId:string):Promise<CareCapabilityReadiness>{
  const response=await authorizedAtlasFetch('/rest/v1/rpc/care_get_capability_readiness',{
    method:'POST',
    body:JSON.stringify({p_org_id:orgId})
  });
  return parse<CareCapabilityReadiness>(response);
}

export async function loadCareWorkspace():Promise<CareWorkspace>{
  const org=await getActiveAtlasOrganization();
  const filter=q(org.id);
  const paths=[
    `/rest/v1/care_people?org_id=${filter}&select=id,org_id,display_name,eligibility_status,eligibility_source,eligibility_verified_at&order=created_at.desc`,
    `/rest/v1/care_caregivers?org_id=${filter}&select=id,org_id,worker_id,full_name,authorization_status,certification_status,certification_expires_on,active&order=created_at.desc`,
    `/rest/v1/care_plans?org_id=${filter}&select=id,org_id,participant_id,caregiver_id,name,start_date,end_date,authorized_minutes_per_week,status&order=created_at.desc`,
    `/rest/v1/care_time_entries?org_id=${filter}&select=id,org_id,plan_id,participant_id,caregiver_id,work_date,started_at,ended_at,minutes,status,payroll_ready,rejection_reason&order=work_date.desc,started_at.desc`
  ];
  const [responses,readiness]=await Promise.all([
    Promise.all(paths.map((path)=>authorizedAtlasFetch(path,{method:'GET'}))),
    loadReadiness(org.id)
  ]);
  const [participants,caregivers,plans,timeEntries]=await Promise.all([
    parse<CareParticipant[]>(responses[0]),
    parse<Caregiver[]>(responses[1]),
    parse<CarePlan[]>(responses[2]),
    parse<CareTimeEntry[]>(responses[3])
  ]);
  return {organizationId:org.id,participants,caregivers,plans,timeEntries,readiness};
}

async function rpc<T=string>(name:string,payload:Record<string,unknown>):Promise<T>{
  const org=await getActiveAtlasOrganization();
  const response=await authorizedAtlasFetch(`/rest/v1/rpc/${name}`,{
    method:'POST',
    body:JSON.stringify({p_org_id:org.id,...payload})
  });
  return parse<T>(response);
}

export const careMutations={
  createParticipant(displayName:string,eligibilityStatus:'pending'|'eligible'|'ineligible'|'review'){
    return rpc<string>('care_create_participant',{p_display_name:displayName,p_eligibility_status:eligibilityStatus});
  },
  createCaregiver(input:{fullName:string;authorizationStatus:'pending'|'authorized'|'suspended';certificationStatus:'pending'|'verified'|'expired';certificationExpiresOn?:string}){
    return rpc<string>('care_create_caregiver',{
      p_full_name:input.fullName,
      p_worker_id:null,
      p_authorization_status:input.authorizationStatus,
      p_certification_status:input.certificationStatus,
      p_certification_expires_on:input.certificationExpiresOn||null
    });
  },
  createPlan(input:{participantId:string;caregiverId:string;name:string;startDate:string;endDate?:string;authorizedMinutesPerWeek:number}){
    return rpc<string>('care_create_plan',{
      p_participant_id:input.participantId,
      p_caregiver_id:input.caregiverId,
      p_name:input.name,
      p_start_date:input.startDate,
      p_end_date:input.endDate||null,
      p_authorized_minutes_per_week:input.authorizedMinutesPerWeek
    });
  },
  createTimeEntry(input:{planId:string;workDate:string;startedAt:string;endedAt:string}){
    return rpc<string>('care_create_time_entry',{
      p_plan_id:input.planId,
      p_work_date:input.workDate,
      p_started_at:input.startedAt,
      p_ended_at:input.endedAt
    });
  },
  transitionTimeEntry(entryId:string,action:'submit'|'approve'|'reject',reason?:string){
    return rpc<string>('care_transition_time_entry',{p_entry_id:entryId,p_action:action,p_reason:reason||null});
  }
};
