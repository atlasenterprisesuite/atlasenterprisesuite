import { authorizedAtlasFetch, getActiveAtlasOrganization } from '../../lib/atlasSession';

export type PeopleWorker = {
  id: string; org_id: string; user_id: string | null; full_name: string; email: string | null;
  department: string | null; job_title: string | null; worker_type: 'employee' | 'contractor';
  status: 'active' | 'leave' | 'terminated';
};
export type PeopleTimeEntry = {
  id: string; org_id: string; worker_id: string; work_date: string; clock_in: string | null;
  clock_out: string | null; break_minutes: number; status: 'draft' | 'submitted' | 'approved' | 'rejected';
};
export type PeopleRequisition = { id: string; org_id: string; title: string; department: string | null; status: string };
export type PeopleCandidate = { id: string; org_id: string; full_name: string; email: string | null; phone: string | null };
export type PeopleApplication = {
  id: string; org_id: string; requisition_id: string; candidate_id: string; stage: string; decision_reason: string | null;
};
export type PeopleCompensation = {
  id: string; org_id: string; worker_id: string; pay_type: 'hourly' | 'salary';
  hourly_rate: number | null; annual_salary: number | null; effective_from: string; effective_to: string | null;
};
export type PeopleDeduction = {
  id: string; org_id: string; worker_id: string; code: string; label: string; treatment: 'pretax' | 'posttax';
  calculation_type: 'fixed' | 'percent'; amount: number; active: boolean;
};

export type PeopleWorkspace = {
  organizationId: string;
  workers: PeopleWorker[];
  timeEntries: PeopleTimeEntry[];
  requisitions: PeopleRequisition[];
  candidates: PeopleCandidate[];
  applications: PeopleApplication[];
  compensation: PeopleCompensation[];
  deductions: PeopleDeduction[];
};

async function parse<T>(response: Response): Promise<T> {
  const text = await response.text();
  let body: unknown = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!response.ok) {
    const message = body && typeof body === 'object' && 'message' in body
      ? String((body as { message?: unknown }).message || 'people_request_failed')
      : typeof body === 'string' && body ? body : `people_request_failed_${response.status}`;
    throw new Error(message);
  }
  return body as T;
}

function orgQuery(organizationId: string) {
  return encodeURIComponent(`eq.${organizationId}`);
}

export async function loadPeopleWorkspace(): Promise<PeopleWorkspace> {
  const organization = await getActiveAtlasOrganization();
  const q = orgQuery(organization.id);
  const paths = [
    `/rest/v1/people_workers?org_id=${q}&select=id,org_id,user_id,full_name,email,department,job_title,worker_type,status&order=full_name.asc`,
    `/rest/v1/people_time_entries?org_id=${q}&select=id,org_id,worker_id,work_date,clock_in,clock_out,break_minutes,status&order=work_date.desc`,
    `/rest/v1/people_requisitions?org_id=${q}&select=id,org_id,title,department,status&order=created_at.desc`,
    `/rest/v1/people_candidates?org_id=${q}&select=id,org_id,full_name,email,phone&order=full_name.asc`,
    `/rest/v1/people_applications?org_id=${q}&select=id,org_id,requisition_id,candidate_id,stage,decision_reason&order=created_at.desc`,
    `/rest/v1/people_compensation?org_id=${q}&select=id,org_id,worker_id,pay_type,hourly_rate,annual_salary,effective_from,effective_to&order=effective_from.desc`,
    `/rest/v1/people_deductions?org_id=${q}&select=id,org_id,worker_id,code,label,treatment,calculation_type,amount,active&order=code.asc`
  ];
  const responses = await Promise.all(paths.map((path) => authorizedAtlasFetch(path, { method: 'GET' })));
  const [workers,timeEntries,requisitions,candidates,applications,compensation,deductions] = await Promise.all([
    parse<PeopleWorker[]>(responses[0]), parse<PeopleTimeEntry[]>(responses[1]), parse<PeopleRequisition[]>(responses[2]),
    parse<PeopleCandidate[]>(responses[3]), parse<PeopleApplication[]>(responses[4]), parse<PeopleCompensation[]>(responses[5]),
    parse<PeopleDeduction[]>(responses[6])
  ]);
  return { organizationId: organization.id, workers, timeEntries, requisitions, candidates, applications, compensation, deductions };
}

async function rpc<T=string>(name: string, payload: Record<string, unknown>): Promise<T> {
  const response = await authorizedAtlasFetch(`/rest/v1/rpc/${name}`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
  return parse<T>(response);
}

async function withOrg<T>(name: string, payload: Record<string, unknown>) {
  const organization = await getActiveAtlasOrganization();
  return rpc<T>(name, { p_org_id: organization.id, ...payload });
}

export const peopleMutations = {
  createWorker(input: { fullName: string; email?: string; department?: string; jobTitle?: string; workerType: 'employee'|'contractor' }) {
    return withOrg<string>('people_create_worker', {
      p_full_name: input.fullName, p_email: input.email || null, p_department: input.department || null,
      p_job_title: input.jobTitle || null, p_worker_type: input.workerType
    });
  },
  updateWorker(input: { workerId: string; fullName: string; email?: string; department?: string; jobTitle?: string; status: 'active'|'leave'|'terminated' }) {
    return withOrg<string>('people_update_worker', {
      p_worker_id: input.workerId, p_full_name: input.fullName, p_email: input.email || null,
      p_department: input.department || null, p_job_title: input.jobTitle || null, p_status: input.status
    });
  },
  createTimeEntry(input: { workerId: string; workDate: string; clockIn?: string; clockOut?: string; breakMinutes: number }) {
    return withOrg<string>('people_create_time_entry', {
      p_worker_id: input.workerId, p_work_date: input.workDate, p_clock_in: input.clockIn || null,
      p_clock_out: input.clockOut || null, p_break_minutes: input.breakMinutes
    });
  },
  transitionTime(entryId: string, action: 'submit'|'approve'|'reject') {
    return withOrg<string>('people_transition_time_entry', { p_entry_id: entryId, p_action: action });
  },
  createRequisition(input: { title: string; department?: string }) {
    return withOrg<string>('people_create_requisition', { p_title: input.title, p_department: input.department || null });
  },
  createCandidate(input: { fullName: string; email?: string; phone?: string }) {
    return withOrg<string>('people_create_candidate', { p_full_name: input.fullName, p_email: input.email || null, p_phone: input.phone || null });
  },
  createApplication(requisitionId: string, candidateId: string) {
    return withOrg<string>('people_create_application', { p_requisition_id: requisitionId, p_candidate_id: candidateId });
  },
  transitionApplication(applicationId: string, nextStage: string, reason?: string) {
    return withOrg<string>('people_transition_application', { p_application_id: applicationId, p_next_stage: nextStage, p_reason: reason || null });
  },
  setCompensation(input: { workerId: string; payType: 'hourly'|'salary'; hourlyRate?: number; annualSalary?: number; effectiveFrom: string }) {
    return withOrg<string>('people_set_compensation', {
      p_worker_id: input.workerId, p_pay_type: input.payType, p_hourly_rate: input.hourlyRate ?? null,
      p_annual_salary: input.annualSalary ?? null, p_effective_from: input.effectiveFrom
    });
  },
  setDeduction(input: { workerId: string; code: string; label: string; treatment: 'pretax'|'posttax'; calculationType: 'fixed'|'percent'; amount: number; active?: boolean }) {
    return withOrg<string>('people_set_deduction', {
      p_worker_id: input.workerId, p_code: input.code, p_label: input.label, p_treatment: input.treatment,
      p_calculation_type: input.calculationType, p_amount: input.amount, p_active: input.active ?? true
    });
  }
};
