import type { TenantScope } from '../../core/src';

export type EmploymentStatus = 'active' | 'leave' | 'terminated';

export interface EmployeeMutation {
  scope: TenantScope;
  fullName: string;
  department: string | null;
  jobTitle: string | null;
  status: EmploymentStatus;
}

export interface EmployeeRecord {
  id: string;
  organizationId: string;
  userId: string | null;
  fullName: string;
  department: string | null;
  jobTitle: string | null;
  status: EmploymentStatus;
  createdAt: string | null;
  updatedAt: string | null;
}

export type TimeEntryStatus = 'draft' | 'submitted' | 'approved' | 'rejected';

export interface TimeEntry {
  id: string;
  organizationId: string;
  employeeId: string;
  workDate: string;
  clockIn: string | null;
  clockOut: string | null;
  breakMinutes: number;
  status: TimeEntryStatus;
  approvedBy: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type PayrollRunStatus = 'draft' | 'calculated' | 'approved' | 'locked' | 'void';

export interface PayrollRun {
  id: string;
  organizationId: string;
  periodStart: string;
  periodEnd: string;
  payDate: string;
  status: PayrollRunStatus;
  approvedBy: string | null;
  approvedAt: string | null;
  voidReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ApplicationStage =
  | 'applied'
  | 'screening'
  | 'assessment'
  | 'interview'
  | 'offer'
  | 'hired'
  | 'rejected'
  | 'withdrawn';

export interface ApplicationRecord {
  id: string;
  organizationId: string;
  requisitionId: string;
  candidateId: string;
  stage: ApplicationStage;
  createdAt: string;
  updatedAt: string;
}

export type PeopleTable =
  | 'employees'
  | 'people_time_entries'
  | 'people_payroll_runs'
  | 'people_applications';
