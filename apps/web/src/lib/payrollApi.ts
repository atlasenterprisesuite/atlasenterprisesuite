import { authorizedAtlasFetch, getActiveAtlasOrganization } from './atlasSession';
import type { BillingMode, BillingStatus, PayrollRunStatus } from '../../../../packages/payroll';

async function parse<T>(response: Response): Promise<T> {
  const text=await response.text();
  const body=text?JSON.parse(text):null;
  if(!response.ok) throw new Error(body?.message||body?.error||`payroll_request_failed:${response.status}`);
  return body as T;
}

async function organizationScope() {
  const organization=await getActiveAtlasOrganization();
  return { organization, filter: encodeURIComponent(`eq.${organization.id}`) };
}

export type PayrollOverview = {
  organizationId: string;
  setupComplete: boolean;
  nextPayrollDate: string | null;
  currentRunStatus: PayrollRunStatus | null;
  workerCount: number | null;
  missingOnboardingItems: number | null;
  timecardExceptions: number | null;
  pendingApprovals: number | null;
  taxConfigurationStatus: 'not_configured'|'incomplete'|'configured';
  disbursementStatus: 'not_configured'|'incomplete'|'verified';
  journalStatus: 'not_generated'|'generated'|'awaiting_posting_approval'|'posted'|'posting_failed'|null;
};

export type PayrollWorker = {
  id: string;
  display_name: string;
  email: string|null;
  worker_type: 'employee'|'contractor';
  employment_status: string;
  hire_date: string|null;
};

export type PayrollTimeEntry = {
  id: string;
  worker_id: string;
  work_date: string;
  category: 'regular'|'overtime'|'paid_leave'|'unpaid_leave';
  source: 'clock'|'import'|'manual';
  minutes: number;
  approval_status: 'pending'|'approved'|'rejected';
  exception_code: string|null;
  locked_by_run_id: string|null;
};

export type PayrollRun = {
  id: string;
  period_start: string;
  period_end: string;
  pay_date: string;
  status: PayrollRunStatus;
  blocked_reason: string|null;
  gross_pay_cents: number|null;
  employee_taxes_cents: number|null;
  employer_taxes_cents: number|null;
  net_pay_cents: number|null;
};

export type PayrollCommercialState = {
  billing_mode: BillingMode;
  billing_status: BillingStatus;
  plan_id: string|null;
  pricing_version: string|null;
  billing_provider: string|null;
};

async function getRows<T>(table:string, select:string, suffix=''):Promise<T[]> {
  const {filter}=await organizationScope();
  return parse<T[]>(await authorizedAtlasFetch(
    `/rest/v1/${table}?organization_id=${filter}&select=${encodeURIComponent(select)}${suffix}`,
    {method:'GET'}
  ));
}

export async function getPayrollOverview():Promise<PayrollOverview>{
  const {organization,filter}=await organizationScope();
  const fetchRows=async<T>(table:string,select:string,suffix='')=>parse<T[]>(await authorizedAtlasFetch(
    `/rest/v1/${table}?organization_id=${filter}&select=${encodeURIComponent(select)}${suffix}`,{method:'GET'}
  ));
  const [entities,schedules,workers,time,runs,tax,bank,journals]=await Promise.all([
    fetchRows<any>('payroll_legal_entities','id','&limit=1'),
    fetchRows<any>('payroll_pay_schedules','id,next_pay_date,active','&active=eq.true&order=next_pay_date.asc&limit=1'),
    fetchRows<any>('payroll_workers','id,employment_status','&employment_status=eq.active'),
    fetchRows<any>('payroll_time_entries','id,exception_code,approval_status','&or=(exception_code.not.is.null,approval_status.eq.pending)'),
    fetchRows<any>('payroll_runs','id,status,pay_date','&order=pay_date.desc&limit=1'),
    fetchRows<any>('payroll_tax_profiles','id,filing_status','&order=effective_from.desc&limit=1'),
    fetchRows<any>('payroll_disbursement_accounts','id,verification_status','&limit=1'),
    fetchRows<any>('payroll_journal_contracts','id,status','&order=created_at.desc&limit=1')
  ]);
  const setupComplete=entities.length>0&&schedules.length>0;
  return {
    organizationId:organization.id,
    setupComplete,
    nextPayrollDate:schedules[0]?.next_pay_date||null,
    currentRunStatus:runs[0]?.status||null,
    workerCount:workers.length,
    missingOnboardingItems:setupComplete?0:null,
    timecardExceptions:time.filter((row:any)=>Boolean(row.exception_code)).length,
    pendingApprovals:time.filter((row:any)=>row.approval_status==='pending').length,
    taxConfigurationStatus:tax[0]?.filing_status==='configured'||tax[0]?.filing_status==='externally_verified'?'configured':tax.length?'incomplete':'not_configured',
    disbursementStatus:bank[0]?.verification_status==='verified'?'verified':bank.length?'incomplete':'not_configured',
    journalStatus:journals[0]?.status||null
  };
}

export async function listPayrollWorkers():Promise<PayrollWorker[]>{
  return getRows<PayrollWorker>('payroll_workers','id,display_name,email,worker_type,employment_status,hire_date','&order=display_name.asc');
}

export async function savePayrollWorker(input:{
  id?:string;displayName:string;email?:string;workerType:'employee'|'contractor';hireDate?:string;
}):Promise<PayrollWorker>{
  const {organization}=await organizationScope();
  const body={
    tenant_id:organization.id,organization_id:organization.id,
    display_name:input.displayName.trim(),email:input.email?.trim()||null,
    worker_type:input.workerType,hire_date:input.hireDate||null,employment_status:'active'
  };
  const path=input.id?`/rest/v1/payroll_workers?id=eq.${encodeURIComponent(input.id)}`:'/rest/v1/payroll_workers';
  const response=await authorizedAtlasFetch(path,{
    method:input.id?'PATCH':'POST',
    headers:{Prefer:'return=representation'},
    body:JSON.stringify(body)
  });
  const rows=await parse<PayrollWorker[]>(response);
  if(!rows[0]) throw new Error('payroll_worker_write_failed');
  return rows[0];
}

export async function listPayrollTimeEntries():Promise<PayrollTimeEntry[]>{
  return getRows<PayrollTimeEntry>('payroll_time_entries','id,worker_id,work_date,category,source,minutes,approval_status,exception_code,locked_by_run_id','&order=work_date.desc');
}

export async function savePayrollTimeEntry(input:{
  id?:string;workerId:string;workDate:string;category:PayrollTimeEntry['category'];source:PayrollTimeEntry['source'];minutes:number;
}):Promise<PayrollTimeEntry>{
  const {organization}=await organizationScope();
  if(!Number.isInteger(input.minutes)||input.minutes<0||input.minutes>1440) throw new Error('invalid_time_minutes');
  if(input.id){
    const existing=(await listPayrollTimeEntries()).find((row)=>row.id===input.id);
    if(existing?.locked_by_run_id) throw new Error('time_entry_locked_by_payroll');
  }
  const body={tenant_id:organization.id,organization_id:organization.id,worker_id:input.workerId,work_date:input.workDate,category:input.category,source:input.source,minutes:input.minutes};
  const response=await authorizedAtlasFetch(input.id?`/rest/v1/payroll_time_entries?id=eq.${encodeURIComponent(input.id)}`:'/rest/v1/payroll_time_entries',{
    method:input.id?'PATCH':'POST',headers:{Prefer:'return=representation'},body:JSON.stringify(body)
  });
  const rows=await parse<PayrollTimeEntry[]>(response);
  if(!rows[0]) throw new Error('payroll_time_write_failed');
  return rows[0];
}

export async function listPayrollRuns():Promise<PayrollRun[]>{
  return getRows<PayrollRun>('payroll_runs','id,period_start,period_end,pay_date,status,blocked_reason,gross_pay_cents,employee_taxes_cents,employer_taxes_cents,net_pay_cents','&order=pay_date.desc');
}

export async function createPayrollRun(input:{periodStart:string;periodEnd:string;payDate:string}):Promise<PayrollRun>{
  const {organization}=await organizationScope();
  const response=await authorizedAtlasFetch('/rest/v1/payroll_runs',{
    method:'POST',headers:{Prefer:'return=representation'},
    body:JSON.stringify({tenant_id:organization.id,organization_id:organization.id,period_start:input.periodStart,period_end:input.periodEnd,pay_date:input.payDate,status:'draft'})
  });
  const rows=await parse<PayrollRun[]>(response);
  if(!rows[0]) throw new Error('payroll_run_create_failed');
  return rows[0];
}

export async function transitionPayrollRun(runId:string,action:'review'|'submit'|'approve'|'process'|'cancel'|'reopen'):Promise<PayrollRun>{
  const response=await authorizedAtlasFetch('/functions/v1/atlas-payroll-run',{
    method:'POST',body:JSON.stringify({run_id:runId,action})
  });
  const body=await parse<{ok:boolean;run:PayrollRun}>(response);
  return body.run;
}

export async function getPayrollCommercialState():Promise<PayrollCommercialState|null>{
  const rows=await getRows<PayrollCommercialState>('payroll_billing_accounts','billing_mode,billing_status,plan_id,pricing_version,billing_provider','&limit=1');
  return rows[0]||null;
}

export async function listPayrollHelp(route:string):Promise<any[]>{
  return parse<any[]>(await authorizedAtlasFetch(
    `/rest/v1/payroll_help_content?active=eq.true&route_tags=cs.%7B${encodeURIComponent(route)}%7D&select=content_id,title,body,source_url,reviewed_date,last_verified_date,owner`,
    {method:'GET'}
  ));
}

export async function savePayrollSetupSection(section:'company'|'tax'|'bank'|'pay_schedule',payload:Record<string,unknown>){
  const {organization}=await organizationScope();
  if(section==='company'){
    const legalName=String(payload.legalName||'').trim();
    if(!legalName) throw new Error('legal_name_required');
    return parse(await authorizedAtlasFetch('/rest/v1/payroll_legal_entities',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({tenant_id:organization.id,organization_id:organization.id,legal_name:legalName,ein_last4:payload.einLast4||null,ein_verification_status:payload.einLast4?'format_valid':'not_verified'})}));
  }
  if(section==='tax'){
    const ein=String(payload.ein||'').trim();
    if(!/^\d{2}-\d{7}$/.test(ein)) throw new Error('invalid_ein_format');
    const entities=await getRows<any>('payroll_legal_entities','id','&limit=1');
    if(!entities[0]) throw new Error('legal_entity_required');
    return parse(await authorizedAtlasFetch('/rest/v1/payroll_tax_profiles',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({tenant_id:organization.id,organization_id:organization.id,legal_entity_id:entities[0].id,jurisdiction:'US-FED',filing_status:'incomplete',source_reference:'user-entered-ein-format-only'})}));
  }
  if(section==='bank'){
    return parse(await authorizedAtlasFetch('/rest/v1/payroll_disbursement_accounts',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({tenant_id:organization.id,organization_id:organization.id,account_label:String(payload.accountLabel||'Payroll account'),account_last4:payload.accountLast4||null,verification_status:'not_configured'})}));
  }
  const entities=await getRows<any>('payroll_legal_entities','id','&limit=1');
  if(!entities[0]) throw new Error('legal_entity_required');
  return parse(await authorizedAtlasFetch('/rest/v1/payroll_pay_schedules',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({tenant_id:organization.id,organization_id:organization.id,legal_entity_id:entities[0].id,cadence:payload.cadence||'biweekly',next_pay_date:payload.nextPayDate||null,effective_from:new Date().toISOString().slice(0,10),active:true})}));
}
