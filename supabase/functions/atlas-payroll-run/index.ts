import { createClient } from 'npm:@supabase/supabase-js@2.95.0';
import { basisPointRuleSet, calculatePayroll } from '../../../packages/payroll/index.ts';
import type { PayrollPermission, PayrollRoleKey } from '../../../packages/payroll/permissions.ts';
import { hasPayrollPermission } from '../../../packages/payroll/permissions.ts';

const URL = Deno.env.get('SUPABASE_URL') || '';
const PUBLISHABLE = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY') || '';
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

type Action = 'review'|'submit'|'approve'|'process'|'cancel'|'reopen';

function json(data: unknown, status=200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type':'application/json; charset=utf-8',
      'cache-control':'no-store',
      'x-content-type-options':'nosniff'
    }
  });
}

function fail(code:string,status=400,details?:Record<string,unknown>):never {
  throw Object.assign(new Error(code), { status, details });
}

function adminClient() {
  if(!URL||!SERVICE_ROLE) fail('server_runtime_not_configured',503);
  return createClient(URL,SERVICE_ROLE,{auth:{persistSession:false,autoRefreshToken:false}});
}

function userClient(req:Request) {
  if(!URL||!PUBLISHABLE) fail('server_runtime_not_configured',503);
  return createClient(URL,PUBLISHABLE,{
    auth:{persistSession:false,autoRefreshToken:false},
    global:{headers:{Authorization:req.headers.get('authorization')||''}}
  });
}

function membershipRoleToPayrollRole(role:string):PayrollRoleKey|null {
  if(role==='owner'||role==='platform_admin') return 'organization_owner';
  if(role==='admin') return 'payroll_admin';
  return null;
}

async function context(req:Request) {
  const token=(req.headers.get('authorization')||'').replace(/^Bearer\s+/i,'');
  if(!token) fail('authentication_required',401);
  const sb=userClient(req);
  const {data:userData,error:userError}=await sb.auth.getUser(token);
  if(userError||!userData.user) fail('invalid_session',401);
  const {data:members,error:memberError}=await sb.from('organization_members')
    .select('org_id,role,status')
    .eq('user_id',userData.user.id)
    .eq('status','active')
    .limit(1);
  if(memberError||!members?.[0]?.org_id) fail('active_organization_required',403);

  const orgId=String(members[0].org_id);
  const membershipRole=String(members[0].role||'member');
  let payrollRole=membershipRoleToPayrollRole(membershipRole);
  if(!payrollRole) {
    const {data:binding}=await sb.from('payroll_admin_bindings')
      .select('payroll_role')
      .eq('organization_id',orgId)
      .eq('user_id',userData.user.id)
      .limit(1)
      .maybeSingle();
    payrollRole=(binding?.payroll_role as PayrollRoleKey|undefined)||null;
  }
  return {userId:userData.user.id,orgId,payrollRole};
}

function requirePermission(role:PayrollRoleKey|null, permission:PayrollPermission) {
  if(!role||!hasPayrollPermission(role,permission)) fail('permission_denied',403,{permission});
}

const transitions:Record<string,readonly string[]>={
  draft:['review','cancelled'],
  review:['draft','awaiting_approval','blocked','cancelled'],
  awaiting_approval:['review','approved','blocked','cancelled'],
  approved:['processing','cancelled'],
  processing:['processed','failed'],
  processed:['posted','reversed'],
  posted:['reversed'],
  blocked:['review','cancelled'],
  failed:['review','cancelled'],
  cancelled:[],
  reversed:[]
};

function nextState(current:string, action:Action) {
  const map:Record<Action,string>={
    review:'review',
    submit:'awaiting_approval',
    approve:'approved',
    process:'processing',
    cancel:'cancelled',
    reopen:'review'
  };
  const next=map[action];
  if(!(transitions[current]||[]).includes(next)) fail('invalid_payroll_transition',409,{current,next});
  return next;
}

async function audit(admin:ReturnType<typeof createClient>,ctx:{orgId:string;userId:string},runId:string,action:string,before:unknown,after:unknown,correlationId:string) {
  const {error}=await admin.from('payroll_audit_events').insert({
    tenant_id:ctx.orgId,organization_id:ctx.orgId,actor_user_id:ctx.userId,
    entity_type:'payroll_run',entity_id:runId,action,before_json:before,after_json:after,
    correlation_id:correlationId
  });
  if(error) fail('payroll_audit_write_failed',500);
}

async function selectTaxRule(admin:ReturnType<typeof createClient>,orgId:string,payDate:string) {
  const {data,error}=await admin.from('payroll_tax_rule_sets')
    .select('id,jurisdiction,version,effective_from,effective_to,validated,employee_tax_bps,employer_tax_bps,source_reference,approved_by,approved_at')
    .eq('organization_id',orgId)
    .eq('jurisdiction','US-FED')
    .eq('validated',true)
    .lte('effective_from',payDate)
    .or(`effective_to.is.null,effective_to.gte.${payDate}`)
    .order('effective_from',{ascending:false})
    .limit(1)
    .maybeSingle();
  if(error) fail('tax_rule_lookup_failed',500);
  if(!data||data.employee_tax_bps===null||data.employer_tax_bps===null||!data.source_reference||!data.approved_by||!data.approved_at) return null;
  return data;
}

async function resolveWorkers(admin:ReturnType<typeof createClient>,orgId:string,runId:string) {
  const {data:links,error:linkError}=await admin.from('payroll_run_workers')
    .select('worker_id').eq('organization_id',orgId).eq('run_id',runId);
  if(linkError) fail('payroll_run_workers_read_failed',500);
  let workerIds=(links||[]).map((row:any)=>String(row.worker_id));
  if(workerIds.length===0) {
    const {data:workers,error}=await admin.from('payroll_workers')
      .select('id').eq('organization_id',orgId).eq('employment_status','active');
    if(error) fail('payroll_workers_read_failed',500);
    workerIds=(workers||[]).map((row:any)=>String(row.id));
    if(workerIds.length===0) fail('no_payroll_workers',409);
    const {error:insertError}=await admin.from('payroll_run_workers').insert(workerIds.map((workerId)=>({
      tenant_id:orgId,organization_id:orgId,run_id:runId,worker_id:workerId
    })));
    if(insertError) fail('payroll_run_workers_snapshot_failed',500);
  }
  const {data,error}=await admin.from('payroll_workers')
    .select('id,worker_type,display_name,employment_status')
    .eq('organization_id',orgId).in('id',workerIds);
  if(error) fail('payroll_workers_read_failed',500);
  return data||[];
}

async function calculateRun(admin:ReturnType<typeof createClient>,ctx:{orgId:string;userId:string},run:any) {
  const rule=await selectTaxRule(admin,ctx.orgId,String(run.pay_date));
  if(!rule) return {blocked:'tax_rule_unavailable' as const};

  const workers=await resolveWorkers(admin,ctx.orgId,String(run.id));
  const ruleSet=basisPointRuleSet({
    jurisdiction:String(rule.jurisdiction),version:String(rule.version),
    effectiveFrom:String(rule.effective_from),effectiveTo:rule.effective_to?String(rule.effective_to):null,
    employeeTaxBps:Number(rule.employee_tax_bps),employerTaxBps:Number(rule.employer_tax_bps),validated:true
  });

  let gross=0,employeeTaxes=0,employerTaxes=0,net=0;
  const calculations:any[]=[];
  for(const worker of workers) {
    const {data:comp,error:compError}=await admin.from('payroll_compensation')
      .select('id,pay_type,amount_cents,effective_from,effective_to')
      .eq('organization_id',ctx.orgId).eq('worker_id',worker.id)
      .lte('effective_from',run.pay_date)
      .or(`effective_to.is.null,effective_to.gte.${run.pay_date}`)
      .order('effective_from',{ascending:false}).limit(1).maybeSingle();
    if(compError) fail('payroll_compensation_read_failed',500);
    if(!comp) return {blocked:'compensation_missing' as const};
    if(comp.pay_type!=='hourly') return {blocked:'unsupported_compensation_calculation' as const};

    const {data:time,error:timeError}=await admin.from('payroll_time_entries')
      .select('id,minutes,approval_status,locked_by_run_id,category')
      .eq('organization_id',ctx.orgId).eq('worker_id',worker.id)
      .gte('work_date',run.period_start).lte('work_date',run.period_end);
    if(timeError) fail('payroll_time_read_failed',500);
    const unapproved=(time||[]).some((row:any)=>row.approval_status!=='approved');
    if(unapproved) return {blocked:'time_approval_required' as const};

    const minutes=(time||[]).filter((row:any)=>row.category==='regular'||row.category==='overtime').reduce((sum:number,row:any)=>sum+Number(row.minutes||0),0);
    const taxableEarningsCents=Math.round((Number(comp.amount_cents)*minutes)/60);

    const {data:deductions,error:dedError}=await admin.from('payroll_deductions')
      .select('amount_cents,pretax').eq('organization_id',ctx.orgId).eq('worker_id',worker.id)
      .lte('effective_from',run.pay_date)
      .or(`effective_to.is.null,effective_to.gte.${run.pay_date}`);
    if(dedError) fail('payroll_deductions_read_failed',500);
    const pretax=(deductions||[]).filter((d:any)=>d.pretax).reduce((sum:number,d:any)=>sum+Number(d.amount_cents||0),0);
    const postTax=(deductions||[]).filter((d:any)=>!d.pretax).reduce((sum:number,d:any)=>sum+Number(d.amount_cents||0),0);

    const input={
      workerId:String(worker.id),periodStart:String(run.period_start),periodEnd:String(run.period_end),
      taxableEarningsCents,nonTaxableEarningsCents:0,reimbursementsCents:0,
      pretaxDeductionsCents:pretax,postTaxDeductionsCents:postTax,garnishmentsCents:0
    };
    const result=calculatePayroll(input,ruleSet);
    gross+=taxableEarningsCents;
    employeeTaxes+=result.employeeTaxesCents;
    employerTaxes+=result.employerTaxesCents;
    net+=result.netPayCents;
    calculations.push({
      tenant_id:ctx.orgId,organization_id:ctx.orgId,run_id:run.id,worker_id:worker.id,
      immutable_input:input,result_json:result,rule_version:result.ruleVersion,checksum:result.checksum
    });

    const entryIds=(time||[]).map((row:any)=>row.id);
    if(entryIds.length) {
      const {error:lockError}=await admin.from('payroll_time_entries')
        .update({locked_by_run_id:run.id,updated_at:new Date().toISOString()})
        .eq('organization_id',ctx.orgId).in('id',entryIds);
      if(lockError) fail('payroll_time_lock_failed',500);
    }
  }

  if(calculations.length) {
    const {error}=await admin.from('payroll_calculations').upsert(calculations,{onConflict:'run_id,worker_id'});
    if(error) fail('payroll_calculation_snapshot_failed',500);
  }

  return {gross,employeeTaxes,employerTaxes,net,ruleVersion:String(rule.version),ruleSource:String(rule.source_reference)};
}

Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS') return new Response(null,{status:204,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'authorization,content-type'}});
  if(req.method!=='POST') return json({ok:false,error:'method_not_allowed'},405);
  try {
    const ctx=await context(req);
    let body:any={};
    try { body=await req.json(); } catch { fail('invalid_json',400); }
    const runId=String(body?.run_id||'').trim();
    const action=String(body?.action||'') as Action;
    if(!runId) fail('run_id_required',422);
    if(!['review','submit','approve','process','cancel','reopen'].includes(action)) fail('invalid_action',422);

    const permission:PayrollPermission=
      action==='approve'?'payroll.run.approve':
      action==='process'?'payroll.run.process':'payroll.run.create';
    requirePermission(ctx.payrollRole,permission);

    const admin=adminClient();
    const {data:run,error}=await admin.from('payroll_runs').select('*')
      .eq('organization_id',ctx.orgId).eq('id',runId).limit(1).maybeSingle();
    if(error) fail('payroll_run_read_failed',500);
    if(!run) fail('payroll_run_not_found',404);

    const next=nextState(String(run.status),action);
    const correlationId=String(run.correlation_id||crypto.randomUUID());

    if(action==='process') {
      const {error:processingError}=await admin.from('payroll_runs').update({
        status:'processing',blocked_reason:null,updated_at:new Date().toISOString()
      }).eq('id',runId).eq('organization_id',ctx.orgId).eq('status','approved');
      if(processingError) fail('payroll_processing_transition_failed',500);

      const calculated=await calculateRun(admin,ctx,run);
      if('blocked' in calculated) {
        const {data:blockedRun,error:blockError}=await admin.from('payroll_runs').update({
          status:'blocked',blocked_reason:calculated.blocked,updated_at:new Date().toISOString()
        }).eq('id',runId).eq('organization_id',ctx.orgId)
          .select('id,period_start,period_end,pay_date,status,blocked_reason,gross_pay_cents,employee_taxes_cents,employer_taxes_cents,net_pay_cents').single();
        if(blockError) fail('payroll_block_write_failed',500);
        await audit(admin,ctx,runId,'process_blocked',run,blockedRun,correlationId);
        return json({ok:true,run:blockedRun,calculation:{status:'blocked',reason:calculated.blocked}});
      }

      const {data:processed,error:processedError}=await admin.from('payroll_runs').update({
        status:'processed',blocked_reason:null,
        gross_pay_cents:calculated.gross,employee_taxes_cents:calculated.employeeTaxes,
        employer_taxes_cents:calculated.employerTaxes,net_pay_cents:calculated.net,
        processed_at:new Date().toISOString(),updated_at:new Date().toISOString()
      }).eq('id',runId).eq('organization_id',ctx.orgId)
        .select('id,period_start,period_end,pay_date,status,blocked_reason,gross_pay_cents,employee_taxes_cents,employer_taxes_cents,net_pay_cents').single();
      if(processedError) fail('payroll_processed_write_failed',500);

      await audit(admin,ctx,runId,'process',run,{...processed,rule_version:calculated.ruleVersion,rule_source:calculated.ruleSource},correlationId);
      return json({ok:true,run:processed,calculation:{status:'processed',rule_version:calculated.ruleVersion,source:calculated.ruleSource}});
    }

    const updates:any={status:next,updated_at:new Date().toISOString()};
    if(action==='approve') { updates.approved_by=ctx.userId; updates.approved_at=new Date().toISOString(); }
    if(action==='reopen') updates.blocked_reason=null;
    const {data:updated,error:updateError}=await admin.from('payroll_runs').update(updates)
      .eq('id',runId).eq('organization_id',ctx.orgId).eq('status',run.status)
      .select('id,period_start,period_end,pay_date,status,blocked_reason,gross_pay_cents,employee_taxes_cents,employer_taxes_cents,net_pay_cents').single();
    if(updateError) fail('payroll_run_transition_failed',500);
    await audit(admin,ctx,runId,action,run,updated,correlationId);
    return json({ok:true,run:updated});
  } catch(error:any) {
    const status=Number(error?.status||500);
    if(status>=500) console.error('atlas-payroll-run',error instanceof Error?error.message:'unknown');
    return json({ok:false,error:error instanceof Error?error.message:'payroll_run_failed',details:error?.details||undefined},status);
  }
});
