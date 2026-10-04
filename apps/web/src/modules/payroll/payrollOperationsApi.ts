import { authorizedAtlasFetch, getActiveAtlasOrganization } from '../../lib/atlasSession';

export type EmployerTaxProfile={id:string;org_id:string;state_code:string;tax_kind:string;employer_rate:number|null;wage_base:number|null;effective_from:string;effective_to:string|null;evidence_hash:string;source_uri:string|null;status:string};
export type WorkerJurisdiction={id:string;org_id:string;worker_id:string;residence_state:string;work_state:string;local_code:string|null;remote_work:boolean;reciprocity_code:string|null;effective_from:string;effective_to:string|null};
export type DeductionDefinition={id:string;org_id:string;code:string;name:string;category:string;taxability:string;active:boolean};
export type WorkerDeduction={id:string;org_id:string;worker_id:string;deduction_definition_id:string;amount_type:string;amount:number;effective_from:string;effective_to:string|null;active:boolean};
export type GarnishmentOrder={id:string;org_id:string;worker_id:string;order_type:string;authority:string;case_reference:string;amount_type:string;amount:number;priority:number;effective_from:string;effective_to:string|null;status:string};
export type ComplianceObligation={id:string;org_id:string;run_id:string|null;jurisdiction:string;obligation_type:string;form_code:string|null;due_date:string;amount:number|null;execution_status:string;provider_connection_id:string|null;provider_evidence_hash:string|null};
export type PaymentBatch={id:string;org_id:string;run_id:string;payment_kind:string;amount:number;execution_status:string;provider_connection_id:string|null;provider_evidence_hash:string|null};
export type GlPosting={id:string;org_id:string;run_id:string;journal_ref:string;status:string;debit_total:number;credit_total:number;evidence_hash:string|null};
export type VarianceFinding={id:string;org_id:string;run_id:string;worker_id:string|null;finding_type:string;severity:string;baseline_value:number|null;current_value:number|null;delta_percent:number|null;requires_review:boolean;status:string;details:Record<string,unknown>};
export type ProviderConnection={id:string;org_id:string;provider_key:string;environment:string;status:string;capabilities:string[];last_verified_at:string|null};

export type PayrollOperations={
  employerTaxProfiles:EmployerTaxProfile[];
  workerJurisdictions:WorkerJurisdiction[];
  deductionDefinitions:DeductionDefinition[];
  workerDeductions:WorkerDeduction[];
  garnishments:GarnishmentOrder[];
  compliance:ComplianceObligation[];
  paymentBatches:PaymentBatch[];
  glPostings:GlPosting[];
  varianceFindings:VarianceFinding[];
  providers:ProviderConnection[];
};

async function parse<T>(response:Response):Promise<T>{
  const text=await response.text(); let body:unknown=null;
  try{body=text?JSON.parse(text):null}catch{body=text}
  if(!response.ok){
    const message=body&&typeof body==='object'&&'message' in body?String((body as {message?:unknown}).message||'payroll_operations_request_failed'):typeof body==='string'&&body?body:`payroll_operations_request_failed_${response.status}`;
    throw new Error(message);
  }
  return body as T;
}
const q=(org:string)=>encodeURIComponent(`eq.${org}`);

export async function loadPayrollOperations():Promise<PayrollOperations>{
  const org=await getActiveAtlasOrganization(); const filter=q(org.id);
  const paths=[
    `/rest/v1/payroll_employer_tax_profiles?org_id=${filter}&select=id,org_id,state_code,tax_kind,employer_rate,wage_base,effective_from,effective_to,evidence_hash,source_uri,status&order=effective_from.desc`,
    `/rest/v1/payroll_worker_jurisdictions?org_id=${filter}&select=id,org_id,worker_id,residence_state,work_state,local_code,remote_work,reciprocity_code,effective_from,effective_to&order=effective_from.desc`,
    `/rest/v1/payroll_deduction_definitions?org_id=${filter}&select=id,org_id,code,name,category,taxability,active&order=code.asc`,
    `/rest/v1/payroll_worker_deductions?org_id=${filter}&select=id,org_id,worker_id,deduction_definition_id,amount_type,amount,effective_from,effective_to,active&order=effective_from.desc`,
    `/rest/v1/payroll_garnishment_orders?org_id=${filter}&select=id,org_id,worker_id,order_type,authority,case_reference,amount_type,amount,priority,effective_from,effective_to,status&order=priority.asc`,
    `/rest/v1/payroll_compliance_obligations?org_id=${filter}&select=id,org_id,run_id,jurisdiction,obligation_type,form_code,due_date,amount,execution_status,provider_connection_id,provider_evidence_hash&order=due_date.asc`,
    `/rest/v1/payroll_payment_batches?org_id=${filter}&select=id,org_id,run_id,payment_kind,amount,execution_status,provider_connection_id,provider_evidence_hash&order=created_at.desc`,
    `/rest/v1/payroll_gl_postings?org_id=${filter}&select=id,org_id,run_id,journal_ref,status,debit_total,credit_total,evidence_hash&order=created_at.desc`,
    `/rest/v1/payroll_variance_findings?org_id=${filter}&select=id,org_id,run_id,worker_id,finding_type,severity,baseline_value,current_value,delta_percent,requires_review,status,details&order=created_at.desc`,
    `/rest/v1/payroll_provider_connections?org_id=${filter}&select=id,org_id,provider_key,environment,status,capabilities,last_verified_at&order=provider_key.asc`
  ];
  const r=await Promise.all(paths.map(path=>authorizedAtlasFetch(path,{method:'GET'})));
  const [employerTaxProfiles,workerJurisdictions,deductionDefinitions,workerDeductions,garnishments,compliance,paymentBatches,glPostings,varianceFindings,providers]=await Promise.all([
    parse<EmployerTaxProfile[]>(r[0]),parse<WorkerJurisdiction[]>(r[1]),parse<DeductionDefinition[]>(r[2]),parse<WorkerDeduction[]>(r[3]),parse<GarnishmentOrder[]>(r[4]),parse<ComplianceObligation[]>(r[5]),parse<PaymentBatch[]>(r[6]),parse<GlPosting[]>(r[7]),parse<VarianceFinding[]>(r[8]),parse<ProviderConnection[]>(r[9])
  ]);
  return {employerTaxProfiles,workerJurisdictions,deductionDefinitions,workerDeductions,garnishments,compliance,paymentBatches,glPostings,varianceFindings,providers};
}

async function rpc<T=string>(name:string,payload:Record<string,unknown>):Promise<T>{
  const org=await getActiveAtlasOrganization();
  const response=await authorizedAtlasFetch(`/rest/v1/rpc/${name}`,{method:'POST',body:JSON.stringify({p_org_id:org.id,...payload})});
  return parse<T>(response);
}

export const payrollOperationsMutations={
  upsertEmployerTaxProfile(input:{stateCode:string;taxKind:string;employerRate:number;wageBase:number;effectiveFrom:string;evidenceHash:string;sourceUri?:string}){
    return rpc<string>('payroll_upsert_employer_tax_profile',{p_state_code:input.stateCode,p_tax_kind:input.taxKind,p_employer_rate:input.employerRate,p_wage_base:input.wageBase,p_effective_from:input.effectiveFrom,p_evidence_hash:input.evidenceHash,p_source_uri:input.sourceUri||null});
  },
  upsertWorkerJurisdiction(input:{workerId:string;residenceState:string;workState:string;effectiveFrom:string;evidenceHash:string;localCode?:string;remoteWork?:boolean;reciprocityCode?:string}){
    return rpc<string>('payroll_upsert_worker_jurisdiction',{p_worker_id:input.workerId,p_residence_state:input.residenceState,p_work_state:input.workState,p_effective_from:input.effectiveFrom,p_evidence_hash:input.evidenceHash,p_local_code:input.localCode||null,p_remote_work:input.remoteWork||false,p_reciprocity_code:input.reciprocityCode||null});
  },
  upsertWorkerDeduction(input:{workerId:string;code:string;name:string;category:string;taxability:string;amountType:string;amount:number;effectiveFrom:string;evidenceHash:string}){
    return rpc<string>('payroll_upsert_worker_deduction',{p_worker_id:input.workerId,p_code:input.code,p_name:input.name,p_category:input.category,p_taxability:input.taxability,p_amount_type:input.amountType,p_amount:input.amount,p_effective_from:input.effectiveFrom,p_evidence_hash:input.evidenceHash});
  },
  recordGarnishment(input:{workerId:string;orderType:string;authority:string;caseReference:string;amountType:string;amount:number;priority:number;effectiveFrom:string;evidenceHash:string}){
    return rpc<string>('payroll_record_garnishment_order',{p_worker_id:input.workerId,p_order_type:input.orderType,p_authority:input.authority,p_case_reference:input.caseReference,p_amount_type:input.amountType,p_amount:input.amount,p_priority:input.priority,p_effective_from:input.effectiveFrom,p_evidence_hash:input.evidenceHash});
  },
  createComplianceObligation(input:{runId?:string;jurisdiction:string;obligationType:string;formCode?:string;dueDate:string;amount?:number;providerConnectionId?:string}){
    return rpc<string>('payroll_create_compliance_obligation',{p_run_id:input.runId||null,p_jurisdiction:input.jurisdiction,p_obligation_type:input.obligationType,p_form_code:input.formCode||null,p_due_date:input.dueDate,p_amount:input.amount??null,p_provider_connection_id:input.providerConnectionId||null});
  },
  createPaymentBatch(input:{runId:string;paymentKind:string;amount:number;providerConnectionId?:string}){
    return rpc<string>('payroll_create_payment_batch',{p_run_id:input.runId,p_payment_kind:input.paymentKind,p_amount:input.amount,p_provider_connection_id:input.providerConnectionId||null});
  },
  recordGlPosting(input:{runId:string;journalRef:string;debitTotal:number;creditTotal:number;status:string;evidenceHash?:string}){
    return rpc<string>('payroll_record_gl_posting',{p_run_id:input.runId,p_journal_ref:input.journalRef,p_debit_total:input.debitTotal,p_credit_total:input.creditTotal,p_status:input.status,p_evidence_hash:input.evidenceHash||null});
  },
  scanRunVariances(runId:string){return rpc<number>('payroll_scan_run_variances',{p_run_id:runId});},
  calculateFloridaReemployment(input:{payDate:string;taxableWages:number;ytdFlWages:number}){return rpc<Record<string,unknown>>('payroll_calculate_fl_reemployment_2026',{p_pay_date:input.payDate,p_taxable_wages:input.taxableWages,p_ytd_fl_wages:input.ytdFlWages});},
  transitionExternalRecord(input:{recordKind:'compliance'|'payment';recordId:string;executionStatus:string;providerEvidenceHash?:string}){return rpc<void>('payroll_transition_external_record',{p_record_kind:input.recordKind,p_record_id:input.recordId,p_execution_status:input.executionStatus,p_provider_evidence_hash:input.providerEvidenceHash||null});}
};

// Canonical RPC identifiers retained explicitly for audit/search contracts:
// payroll_upsert_worker_jurisdiction payroll_upsert_employer_tax_profile payroll_upsert_worker_deduction
// payroll_record_garnishment_order payroll_create_compliance_obligation payroll_create_payment_batch
// payroll_record_gl_posting payroll_scan_run_variances
