export type AutomationInput = {
  companies: number;
  documentsPerCompany: number;
  bankAccountsPerCompany: number;
  employeesPerCompany: number;
  inventoryMovesPerCompany: number;
  requestsPerCompany: number;
  adminDocumentsPerCompany: number;
  hourlyCost: number;
  monthlyPlatformCost: number;
  setupCost: number;
};

export const DEFAULT_AUTOMATION_INPUT: AutomationInput = {
  companies: 15, documentsPerCompany: 30, bankAccountsPerCompany: 1,
  employeesPerCompany: 5, inventoryMovesPerCompany: 50,
  requestsPerCompany: 10, adminDocumentsPerCompany: 10,
  hourlyCost: 30, monthlyPlatformCost: 2000, setupCost: 15000
};

// Planning assumptions in minutes per item. These are editable scenario inputs, not observed ATLAS throughput.
export const AUTOMATION_PROCESSES = [
  { id: 'ap', label: 'Accounts Payable', unit: 'invoices', manual: 8, assisted: 2, route: '/finance/accounting/accounts-payable' },
  { id: 'ar', label: 'Accounts Receivable', unit: 'invoices', manual: 6, assisted: 1.5, route: '/finance/accounting/accounts-receivable' },
  { id: 'bank', label: 'Bank reconciliation', unit: 'accounts', manual: 90, assisted: 30, route: '/finance' },
  { id: 'close', label: 'GL and close', unit: 'monthly closes', manual: 240, assisted: 120, route: '/finance/accounting' },
  { id: 'people', label: 'People and payroll', unit: 'employees', manual: 20, assisted: 8, route: '/people' },
  { id: 'inventory', label: 'Inventory', unit: 'movements', manual: 3, assisted: 1, route: '/inventory/procure-to-pay' },
  { id: 'operations', label: 'Purchasing and operations', unit: 'requests', manual: 10, assisted: 4, route: '/inventory/procure-to-pay' },
  { id: 'admin', label: 'Administration', unit: 'documents', manual: 8, assisted: 3, route: '/advisory/documents' }
] as const;

export function calculateAutomationScenario(input: AutomationInput) {
  if (Object.values(input).some((value) => !Number.isFinite(value) || value < 0)) {
    throw new Error('All scenario inputs must be finite and non-negative.');
  }
  const companies = input.companies;
  const volumes = {
    ap: companies * input.documentsPerCompany / 2,
    ar: companies * input.documentsPerCompany / 2,
    bank: companies * input.bankAccountsPerCompany,
    close: companies,
    people: companies * input.employeesPerCompany,
    inventory: companies * input.inventoryMovesPerCompany,
    operations: companies * input.requestsPerCompany,
    admin: companies * input.adminDocumentsPerCompany
  };
  const rows = AUTOMATION_PROCESSES.map((process) => {
    const volume = volumes[process.id];
    const manualHours = volume * process.manual / 60;
    const assistedHours = volume * process.assisted / 60;
    return { ...process, volume, manualHours, assistedHours, savedHours: manualHours - assistedHours };
  });
  const manualHours = rows.reduce((sum, row) => sum + row.manualHours, 0);
  const assistedHours = rows.reduce((sum, row) => sum + row.assistedHours, 0);
  const savedHours = manualHours - assistedHours;
  const grossMonthlyCapacity = savedHours * input.hourlyCost;
  const monthlyNetCapacity = grossMonthlyCapacity - input.monthlyPlatformCost;
  const firstYearNet = grossMonthlyCapacity * 12 - input.monthlyPlatformCost * 12 - input.setupCost;
  const firstYearCost = input.monthlyPlatformCost * 12 + input.setupCost;
  return {
    rows, manualHours, assistedHours, savedHours, grossMonthlyCapacity,
    monthlyNetCapacity, firstYearNet,
    firstYearRoi: firstYearCost > 0 ? firstYearNet / firstYearCost : null,
    paybackMonths: monthlyNetCapacity > 0 ? input.setupCost / monthlyNetCapacity : null
  };
}
