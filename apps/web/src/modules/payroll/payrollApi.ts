import { authorizedAtlasFetch, getActiveAtlasOrganization } from '../../lib/atlasSession';

export type PayrollSchedule={id:string;org_id:string;name:string;frequency:string;active:boolean};
export type PayrollRun={id:string;org_id:string;schedule_id:string|null;period_start:string;period_end:string;pay_date:string;status:'draft'|'calculated'|'approved'|'locked'|'void';void_reason:string|null};
export type PayrollLine={id:string;org_id:string;run_id:string;worker_id:string;regular_hours:number;overtime_hours:number;hourly_rate:number|null;salary_period_amount:number|null;gross_pay:number;pretax_deductions:number;taxes_withheld:number;posttax_deductions:number;net_pay:number;calculation:Record<string,unknown>};
export type PayrollWorker={id:string;full_name:string;worker_type:string;status:string;job_title:string|null};
export type PayrollTimeEntry={id:string;worker_id:string;work_date:string;status:string;clock_in:string|null;clock_out:string|null;break_minutes:number};
export type PayrollWorkspace={organizationId:string;schedules:PayrollSchedule[];runs:PayrollRun[];lines:PayrollLine[];workers:PayrollWorker[];timeEntries:PayrollTimeEntry[]};

async function parse<T>(response:Response):Promise<T>{
  const text=await response.text(); let body:unknown=null;
  try{body=text?JSON.parse(text):null}catch{body=text}
  if(!response.ok){
    const message=body&&typeof body==='object'&&'message' in body?String((body as {message?:unknown}).message||'payroll_request_failed'):typeof body==='string'&&body?body:`payroll_request_failed_${response.status}`;
    throw new Error(message);
  }
  return body as T;
}
const q=(org:string)=>encodeURIComponent(`eq.${org}`);

export async function loadPayrollWorkspace():Promise<PayrollWorkspace>{
  const org=await getActiveAtlasOrganization(); const filter=q(org.id);
  const paths=[
    `/rest/v1/payroll_schedules?org_id=${filter}&select=id,org_id,name,frequency,active&order=name.asc`,
    `/rest/v1/payroll_runs?org_id=${filter}&select=id,org_id,schedule_id,period_start,period_end,pay_date,status,void_reason&order=pay_date.desc`,
    `/rest/v1/payroll_run_lines?org_id=${filter}&select=id,org_id,run_id,worker_id,regular_hours,overtime_hours,hourly_rate,salary_period_amount,gross_pay,pretax_deductions,taxes_withheld,posttax_deductions,net_pay,calculation&order=created_at.asc`,
    `/rest/v1/people_workers?org_id=${filter}&select=id,full_name,worker_type,status,job_title&order=full_name.asc`,
    `/rest/v1/people_time_entries?org_id=${filter}&select=id,worker_id,work_date,status,clock_in,clock_out,break_minutes&order=work_date.desc`
  ];
  const responses=await Promise.all(paths.map(path=>authorizedAtlasFetch(path,{method:'GET'})));
  const [schedules,runs,lines,workers,timeEntries]=await Promise.all([
    parse<PayrollSchedule[]>(responses[0]),parse<PayrollRun[]>(responses[1]),parse<PayrollLine[]>(responses[2]),
    parse<PayrollWorker[]>(responses[3]),parse<PayrollTimeEntry[]>(responses[4])
  ]);
  return {organizationId:org.id,schedules,runs,lines,workers,timeEntries};
}

async function rpc<T=string>(name:string,payload:Record<string,unknown>):Promise<T>{
  const org=await getActiveAtlasOrganization();
  const response=await authorizedAtlasFetch(`/rest/v1/rpc/${name}`,{method:'POST',body:JSON.stringify({p_org_id:org.id,...payload})});
  return parse<T>(response);
}

export const payrollMutations={
  createSchedule(name:string,frequency:string){return rpc<string>('payroll_create_schedule',{p_name:name,p_frequency:frequency});},
  createRun(input:{scheduleId?:string;periodStart:string;periodEnd:string;payDate:string}){return rpc<string>('payroll_create_run',{p_schedule_id:input.scheduleId||null,p_period_start:input.periodStart,p_period_end:input.periodEnd,p_pay_date:input.payDate});},
  upsertLine(input:{runId:string;workerId:string;regularHours:number;overtimeHours:number;hourlyRate?:number;salaryPeriodAmount?:number;pretaxDeductions:number;taxesWithheld:number;posttaxDeductions:number}){
    return rpc<string>('payroll_upsert_line',{
      p_run_id:input.runId,p_worker_id:input.workerId,p_regular_hours:input.regularHours,p_overtime_hours:input.overtimeHours,
      p_hourly_rate:input.hourlyRate??null,p_overtime_multiplier:1.5,p_salary_period_amount:input.salaryPeriodAmount??null,
      p_pretax_deductions:input.pretaxDeductions,p_taxes_withheld:input.taxesWithheld,p_posttax_deductions:input.posttaxDeductions
    });
  },
  transitionRun(runId:string,action:'calculate'|'approve'|'lock'|'void',reason?:string){return rpc<string>('payroll_transition_run',{p_run_id:runId,p_action:action,p_reason:reason||null});}
};
