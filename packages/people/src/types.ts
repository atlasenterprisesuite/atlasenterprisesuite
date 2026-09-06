import type { TenantScope } from '../../core/src';

export type EmploymentStatus = 'active' | 'leave' | 'terminated';

export interface EmployeeMutation {
  scope: TenantScope;
  fullName: string;
  department: string | null;
  jobTitle: string | null;
  status: EmploymentStatus;
}

export interface EmployeeRecord extends EmployeeMutation {
  id: string;
  userId: string | null;
  createdAt: string;
  updatedAt: string;
}
