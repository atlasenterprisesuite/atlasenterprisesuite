import { authorizedAtlasFetch, getActiveAtlasOrganization } from './atlasSession';

async function parse<T>(response:Response):Promise<T>{
  const text=await response.text();
  const body=text?JSON.parse(text):null;
  if(!response.ok) throw new Error(body?.message||body?.error||'events_request_failed');
  return body as T;
}

async function scope(){
  const organization=await getActiveAtlasOrganization();
  return {organization,filter:encodeURIComponent('eq.'+organization.id)};
}

export type AtlasEvent={
  id:string; name:string; starts_at:string; ends_at:string|null; venue_id:string|null;
  capacity:number|null; lifecycle_status:'planned'|'on_sale'|'live'|'closed'|'cancelled'; currency:string;
};
export type EventVenue={id:string;name:string;capacity:number|null;address_json:Record<string,unknown>};
export type EventTalent={id:string;display_name:string;booking_status:string;contract_evidence_reference:string|null};
export type EventProductionTask={id:string;event_id:string;title:string;workstream:string;status:string;due_at:string|null;blocker_reason:string|null};
export type EventSettlement={id:string;event_id:string;counterparty_type:string;counterparty_reference:string;gross_amount_cents:number;deductions_cents:number;net_amount_cents:number;status:string;payment_evidence_reference:string|null};

export async function listEvents():Promise<AtlasEvent[]>{
  const {filter}=await scope();
  return parse(await authorizedAtlasFetch('/rest/v1/events?organization_id='+filter+'&select=id,name,starts_at,ends_at,venue_id,capacity,lifecycle_status,currency&order=starts_at.asc',{method:'GET'}));
}

export async function createEvent(input:{name:string;startsAt:string;endsAt?:string;venueId?:string;capacity?:number}):Promise<AtlasEvent>{
  const {organization}=await scope();
  const rows=await parse<AtlasEvent[]>(await authorizedAtlasFetch('/rest/v1/events',{
    method:'POST',headers:{Prefer:'return=representation'},
    body:JSON.stringify({
      tenant_id:organization.id,organization_id:organization.id,name:input.name.trim(),
      starts_at:input.startsAt,ends_at:input.endsAt||null,venue_id:input.venueId||null,
      capacity:Number.isFinite(input.capacity)?input.capacity:null,lifecycle_status:'planned',currency:'USD'
    })
  }));
  if(!rows[0]) throw new Error('event_create_failed');
  return rows[0];
}

export async function listEventVenues():Promise<EventVenue[]>{
  const {filter}=await scope();
  return parse(await authorizedAtlasFetch('/rest/v1/event_venues?organization_id='+filter+'&select=id,name,capacity,address_json&order=name.asc',{method:'GET'}));
}

export async function createEventVenue(input:{name:string;capacity?:number}):Promise<EventVenue>{
  const {organization}=await scope();
  const rows=await parse<EventVenue[]>(await authorizedAtlasFetch('/rest/v1/event_venues',{
    method:'POST',headers:{Prefer:'return=representation'},
    body:JSON.stringify({tenant_id:organization.id,organization_id:organization.id,name:input.name.trim(),capacity:Number.isFinite(input.capacity)?input.capacity:null,address_json:{}})
  }));
  if(!rows[0]) throw new Error('event_venue_create_failed');
  return rows[0];
}

export async function listEventTalent():Promise<EventTalent[]>{
  const {filter}=await scope();
  return parse(await authorizedAtlasFetch('/rest/v1/event_talent?organization_id='+filter+'&select=id,display_name,booking_status,contract_evidence_reference&order=display_name.asc',{method:'GET'}));
}

export async function createEventTalent(displayName:string):Promise<EventTalent>{
  const {organization}=await scope();
  const rows=await parse<EventTalent[]>(await authorizedAtlasFetch('/rest/v1/event_talent',{
    method:'POST',headers:{Prefer:'return=representation'},
    body:JSON.stringify({tenant_id:organization.id,organization_id:organization.id,display_name:displayName.trim(),booking_status:'planned'})
  }));
  if(!rows[0]) throw new Error('event_talent_create_failed');
  return rows[0];
}

export async function listProductionTasks():Promise<EventProductionTask[]>{
  const {filter}=await scope();
  return parse(await authorizedAtlasFetch('/rest/v1/event_production_tasks?organization_id='+filter+'&select=id,event_id,title,workstream,status,due_at,blocker_reason&order=created_at.desc',{method:'GET'}));
}

export async function createProductionTask(input:{eventId:string;title:string;workstream:string;dueAt?:string}):Promise<EventProductionTask>{
  const {organization}=await scope();
  const rows=await parse<EventProductionTask[]>(await authorizedAtlasFetch('/rest/v1/event_production_tasks',{
    method:'POST',headers:{Prefer:'return=representation'},
    body:JSON.stringify({tenant_id:organization.id,organization_id:organization.id,event_id:input.eventId,title:input.title.trim(),workstream:input.workstream||'general',due_at:input.dueAt||null,status:'open'})
  }));
  if(!rows[0]) throw new Error('event_task_create_failed');
  return rows[0];
}

export async function listEventSettlements():Promise<EventSettlement[]>{
  const {filter}=await scope();
  return parse(await authorizedAtlasFetch('/rest/v1/event_settlements?organization_id='+filter+'&select=id,event_id,counterparty_type,counterparty_reference,gross_amount_cents,deductions_cents,net_amount_cents,status,payment_evidence_reference&order=created_at.desc',{method:'GET'}));
}

export async function createSettlementDraft(input:{eventId:string;counterpartyType:string;counterpartyReference:string;grossAmountCents:number;deductionsCents:number}):Promise<EventSettlement>{
  const {organization}=await scope();
  const rows=await parse<EventSettlement[]>(await authorizedAtlasFetch('/rest/v1/event_settlements',{
    method:'POST',headers:{Prefer:'return=representation'},
    body:JSON.stringify({
      tenant_id:organization.id,organization_id:organization.id,event_id:input.eventId,
      counterparty_type:input.counterpartyType,counterparty_reference:input.counterpartyReference,
      gross_amount_cents:input.grossAmountCents,deductions_cents:input.deductionsCents,
      status:'draft',payment_evidence_reference:null
    })
  }));
  if(!rows[0]) throw new Error('event_settlement_create_failed');
  return rows[0];
}
