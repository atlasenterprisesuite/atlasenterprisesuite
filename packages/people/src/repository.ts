import type {
  ApplicationRecord,
  ApplicationStage,
  EmployeeRecord,
  EmploymentStatus,
  PayrollLineRecord,
  PayrollRun,
  PayrollRunStatus,
  PeopleTable,
  TimeEntry,
  TimeEntryStatus,
} from './types';

export interface PeopleReadGateway {
  select<T>(table: PeopleTable, columns: string, organizationId: string): Promise<T[]>;
}

export interface PeopleRepository {
  listEmployees(organizationId: string): Promise<EmployeeRecord[]>;
  getEmployee(organizationId: string, employeeId: string): Promise<EmployeeRecord | null>;
  listTimeEntries(organizationId: string, employeeId?: string): Promise<TimeEntry[]>;
  listPayrollRuns(organizationId: string): Promise<PayrollRun[]>;
  listPayrollLines(organizationId: string, payrollRunId?: string): Promise<PayrollLineRecord[]>;
  listApplications(organizationId: string): Promise<ApplicationRecord[]>;
}

type EmployeeRow = {
  id: string; org_id: string | null; user_id: string | null; full_name: string;
  department: string | null; job_title: string | null; status: string | null;
  created_at: string | null; updated_at: string | null;
};

type TimeEntryRow = {
  id: string; org_id: string; employee_id: string; work_date: string;
  clock_in: string | null; clock_out: string | null; break_minutes: number; status: string;
  approved_by: string | null; approved_at: string | null; created_at: string; updated_at: string;
};

type PayrollRunRow = {
  id: string; org_id: string; period_start: string; period_end: string; pay_date: string;
  status: string; approved_by: string | null; approved_at: string | null; void_reason: string | null;
  created_at: string; updated_at: string;
};

type PayrollLineRow = {
  id: string; org_id: string; payroll_run_id: string; employee_id: string;
  regular_hours: number; overtime_hours: number; hourly_rate: number | null;
  salary_period_amount: number | null; gross_pay: number; pretax_deductions: number;
  taxes_withheld: number; posttax_deductions: number; net_pay: number; calculation: unknown;
  created_at: string; updated_at: string;
};

type ApplicationRow = {
  id: string; org_id: string; requisition_id: string; candidate_id: string;
  stage: string; created_at: string; updated_at: string;
};

const employmentStatuses = new Set<EmploymentStatus>(['active', 'leave', 'terminated']);
const timeEntryStatuses = new Set<TimeEntryStatus>(['draft', 'submitted', 'approved', 'rejected']);
const payrollRunStatuses = new Set<PayrollRunStatus>(['draft', 'calculated', 'approved', 'locked', 'void']);
const applicationStages = new Set<ApplicationStage>([
  'applied', 'screening', 'assessment', 'interview', 'offer', 'hired', 'rejected', 'withdrawn',
]);

function requireOrganizationId(organizationId: string): string {
  const value = organizationId.trim();
  if (!value) throw new Error('organizationId is required');
  return value;
}

function requireRecordId(recordId: string, label: string): string {
  const value = recordId.trim();
  if (!value) throw new Error(`${label} is required`);
  return value;
}

function employmentStatus(value: string | null): EmploymentStatus {
  if (value && employmentStatuses.has(value as EmploymentStatus)) return value as EmploymentStatus;
  throw new Error(`Unsupported employment status: ${value ?? 'null'}`);
}

function timeEntryStatus(value: string): TimeEntryStatus {
  if (timeEntryStatuses.has(value as TimeEntryStatus)) return value as TimeEntryStatus;
  throw new Error(`Unsupported time entry status: ${value}`);
}

function payrollRunStatus(value: string): PayrollRunStatus {
  if (payrollRunStatuses.has(value as PayrollRunStatus)) return value as PayrollRunStatus;
  throw new Error(`Unsupported payroll run status: ${value}`);
}

function applicationStage(value: string): ApplicationStage {
  if (applicationStages.has(value as ApplicationStage)) return value as ApplicationStage;
  throw new Error(`Unsupported application stage: ${value}`);
}

function mapEmployee(row: EmployeeRow): EmployeeRecord {
  if (!row.org_id) throw new Error(`Employee ${row.id} is missing organization scope`);
  return {
    id: row.id, organizationId: row.org_id, userId: row.user_id, fullName: row.full_name,
    department: row.department, jobTitle: row.job_title, status: employmentStatus(row.status),
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

function mapTimeEntry(row: TimeEntryRow): TimeEntry {
  return {
    id: row.id, organizationId: row.org_id, employeeId: row.employee_id, workDate: row.work_date,
    clockIn: row.clock_in, clockOut: row.clock_out, breakMinutes: row.break_minutes,
    status: timeEntryStatus(row.status), approvedBy: row.approved_by, approvedAt: row.approved_at,
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

function mapPayrollRun(row: PayrollRunRow): PayrollRun {
  return {
    id: row.id, organizationId: row.org_id, periodStart: row.period_start, periodEnd: row.period_end,
    payDate: row.pay_date, status: payrollRunStatus(row.status), approvedBy: row.approved_by,
    approvedAt: row.approved_at, voidReason: row.void_reason, createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapPayrollLine(row: PayrollLineRow): PayrollLineRecord {
  return {
    id: row.id, organizationId: row.org_id, payrollRunId: row.payroll_run_id,
    employeeId: row.employee_id, regularHours: row.regular_hours, overtimeHours: row.overtime_hours,
    hourlyRate: row.hourly_rate, salaryPeriodAmount: row.salary_period_amount, grossPay: row.gross_pay,
    pretaxDeductions: row.pretax_deductions, taxesWithheld: row.taxes_withheld,
    posttaxDeductions: row.posttax_deductions, netPay: row.net_pay, calculation: row.calculation,
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

function mapApplication(row: ApplicationRow): ApplicationRecord {
  return {
    id: row.id, organizationId: row.org_id, requisitionId: row.requisition_id,
    candidateId: row.candidate_id, stage: applicationStage(row.stage),
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

export class PeopleRepositoryImpl implements PeopleRepository {
  constructor(private readonly gateway: PeopleReadGateway) {}

  async listEmployees(organizationId: string): Promise<EmployeeRecord[]> {
    const orgId = requireOrganizationId(organizationId);
    const rows = await this.gateway.select<EmployeeRow>(
      'employees', 'id,org_id,user_id,full_name,department,job_title,status,created_at,updated_at', orgId,
    );
    return rows.filter((row) => row.org_id === orgId).map(mapEmployee);
  }

  async getEmployee(organizationId: string, employeeId: string): Promise<EmployeeRecord | null> {
    const orgId = requireOrganizationId(organizationId);
    const id = requireRecordId(employeeId, 'employeeId');
    const rows = await this.gateway.select<EmployeeRow>(
      'employees', 'id,org_id,user_id,full_name,department,job_title,status,created_at,updated_at', orgId,
    );
    const row = rows.find((candidate) => candidate.org_id === orgId && candidate.id === id);
    return row ? mapEmployee(row) : null;
  }

  async listTimeEntries(organizationId: string, employeeId?: string): Promise<TimeEntry[]> {
    const orgId = requireOrganizationId(organizationId);
    const requestedEmployeeId = employeeId ? requireRecordId(employeeId, 'employeeId') : null;
    const rows = await this.gateway.select<TimeEntryRow>(
      'people_time_entries',
      'id,org_id,employee_id,work_date,clock_in,clock_out,break_minutes,status,approved_by,approved_at,created_at,updated_at',
      orgId,
    );
    return rows
      .filter((row) => row.org_id === orgId && (!requestedEmployeeId || row.employee_id === requestedEmployeeId))
      .map(mapTimeEntry);
  }

  async listPayrollRuns(organizationId: string): Promise<PayrollRun[]> {
    const orgId = requireOrganizationId(organizationId);
    const rows = await this.gateway.select<PayrollRunRow>(
      'people_payroll_runs',
      'id,org_id,period_start,period_end,pay_date,status,approved_by,approved_at,void_reason,created_at,updated_at',
      orgId,
    );
    return rows.filter((row) => row.org_id === orgId).map(mapPayrollRun);
  }

  async listPayrollLines(organizationId: string, payrollRunId?: string): Promise<PayrollLineRecord[]> {
    const orgId = requireOrganizationId(organizationId);
    const requestedRunId = payrollRunId ? requireRecordId(payrollRunId, 'payrollRunId') : null;
    const rows = await this.gateway.select<PayrollLineRow>(
      'people_payroll_lines',
      'id,org_id,payroll_run_id,employee_id,regular_hours,overtime_hours,hourly_rate,salary_period_amount,gross_pay,pretax_deductions,taxes_withheld,posttax_deductions,net_pay,calculation,created_at,updated_at',
      orgId,
    );
    return rows
      .filter((row) => row.org_id === orgId && (!requestedRunId || row.payroll_run_id === requestedRunId))
      .map(mapPayrollLine);
  }

  async listApplications(organizationId: string): Promise<ApplicationRecord[]> {
    const orgId = requireOrganizationId(organizationId);
    const rows = await this.gateway.select<ApplicationRow>(
      'people_applications', 'id,org_id,requisition_id,candidate_id,stage,created_at,updated_at', orgId,
    );
    return rows.filter((row) => row.org_id === orgId).map(mapApplication);
  }
}
