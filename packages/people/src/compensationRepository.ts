import type {
  CompensationRecord,
  DeductionCalculationType,
  DeductionTreatment,
  PayType,
} from './compensation';

export type CompensationTable = 'people_compensation' | 'people_deductions';

export interface DeductionRecord {
  id: string;
  organizationId: string;
  employeeId: string;
  code: string;
  label: string;
  treatment: DeductionTreatment;
  calculationType: DeductionCalculationType;
  amount: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CompensationReadGateway {
  select<T>(table: CompensationTable, columns: string, organizationId: string): Promise<T[]>;
}

export interface CompensationRepository {
  listCompensation(organizationId: string, employeeId?: string): Promise<CompensationRecord[]>;
  listDeductions(organizationId: string, employeeId?: string): Promise<DeductionRecord[]>;
}

type CompensationRow = {
  id: string; org_id: string; employee_id: string; pay_type: string; hourly_rate: number | null;
  annual_salary: number | null; effective_from: string; effective_to: string | null;
  created_at: string; updated_at: string;
};
type DeductionRow = {
  id: string; org_id: string; employee_id: string; code: string; label: string; treatment: string;
  calculation_type: string; amount: number; active: boolean; created_at: string; updated_at: string;
};

const payTypes = new Set<PayType>(['hourly', 'salary']);
const treatments = new Set<DeductionTreatment>(['pretax', 'posttax']);
const calculationTypes = new Set<DeductionCalculationType>(['fixed', 'percent']);

function requireText(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} is required`);
  return normalized;
}

export class CompensationRepositoryImpl implements CompensationRepository {
  constructor(private readonly gateway: CompensationReadGateway) {}

  async listCompensation(organizationId: string, employeeId?: string): Promise<CompensationRecord[]> {
    const orgId = requireText(organizationId, 'organizationId');
    const requestedEmployeeId = employeeId ? requireText(employeeId, 'employeeId') : null;
    const rows = await this.gateway.select<CompensationRow>(
      'people_compensation',
      'id,org_id,employee_id,pay_type,hourly_rate,annual_salary,effective_from,effective_to,created_at,updated_at',
      orgId,
    );
    return rows
      .filter((row) => row.org_id === orgId && (!requestedEmployeeId || row.employee_id === requestedEmployeeId))
      .map((row) => {
        if (!payTypes.has(row.pay_type as PayType)) throw new Error(`Unsupported pay type: ${row.pay_type}`);
        return {
          id: row.id,
          organizationId: row.org_id,
          employeeId: row.employee_id,
          payType: row.pay_type as PayType,
          hourlyRate: row.hourly_rate,
          annualSalary: row.annual_salary,
          effectiveFrom: row.effective_from,
          effectiveTo: row.effective_to,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        };
      });
  }

  async listDeductions(organizationId: string, employeeId?: string): Promise<DeductionRecord[]> {
    const orgId = requireText(organizationId, 'organizationId');
    const requestedEmployeeId = employeeId ? requireText(employeeId, 'employeeId') : null;
    const rows = await this.gateway.select<DeductionRow>(
      'people_deductions',
      'id,org_id,employee_id,code,label,treatment,calculation_type,amount,active,created_at,updated_at',
      orgId,
    );
    return rows
      .filter((row) => row.org_id === orgId && (!requestedEmployeeId || row.employee_id === requestedEmployeeId))
      .map((row) => {
        if (!treatments.has(row.treatment as DeductionTreatment)) {
          throw new Error(`Unsupported deduction treatment: ${row.treatment}`);
        }
        if (!calculationTypes.has(row.calculation_type as DeductionCalculationType)) {
          throw new Error(`Unsupported deduction calculation type: ${row.calculation_type}`);
        }
        return {
          id: row.id,
          organizationId: row.org_id,
          employeeId: row.employee_id,
          code: row.code,
          label: row.label,
          treatment: row.treatment as DeductionTreatment,
          calculationType: row.calculation_type as DeductionCalculationType,
          amount: row.amount,
          active: row.active,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        };
      });
  }
}
