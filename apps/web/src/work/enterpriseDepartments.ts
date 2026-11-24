import type { WorkWorkflow } from './types';

export const ENTERPRISE_DEPARTMENTS = [
  { id: 'executive', name: 'Executive direction', modules: ['manager', 'business', 'advisory', 'analytics'], primary: 'manager' },
  { id: 'engineering', name: 'Engineering', modules: ['release-control', 'site-review'], primary: 'release-control' },
  { id: 'finance', name: 'Finance and accounting', modules: ['finance', 'accounting', 'pay', 'tax', 'inventory', 'payroll'], primary: 'accounting' },
  { id: 'legal', name: 'Compliance and trust', modules: ['certificate-lifecycle', 'insurance'], primary: 'certificate-lifecycle' },
  { id: 'research', name: 'Scientific research', modules: ['assistant', 'aviation'], primary: 'assistant' },
  { id: 'university', name: 'University and people', modules: ['learning', 'people'], primary: 'learning' },
  { id: 'health', name: 'Health and care', modules: ['health', 'care'], primary: 'health' },
  { id: 'marketing', name: 'Marketing and communications', modules: ['studio', 'connect', 'voice', 'crm', 'revenue', 'commerce', 'events'], primary: 'studio' },
  { id: 'infrastructure', name: 'Infrastructure and operations', modules: ['cloud', 'device-os', 'telecom', 'city', 'gps', 'galaxy', 'ride', 'hospitality', 'frontier'], primary: 'cloud' },
  { id: 'library', name: 'Central library', modules: ['knowledge', 'bible-os'], primary: 'knowledge' }
] as const;

export type EnterpriseDepartment = typeof ENTERPRISE_DEPARTMENTS[number];
export type DepartmentSummary = {
  department: EnterpriseDepartment;
  workflows: WorkWorkflow[];
  awaitingApproval: number;
  completed: number;
  blocked: number;
  inProgress: number;
};

export function projectEnterpriseDepartments(workflows: readonly WorkWorkflow[]) {
  const assigned = new Set<string>();
  const departments: DepartmentSummary[] = ENTERPRISE_DEPARTMENTS.map(department => {
    const modules: readonly string[] = department.modules;
    const items = workflows.filter(workflow => modules.includes(workflow.ownerModule));
    items.forEach(workflow => assigned.add(workflow.id));
    return {
      department, workflows: items,
      awaitingApproval: items.filter(w => w.status === 'awaiting_approval').length,
      completed: items.filter(w => w.status === 'completed').length,
      blocked: items.filter(w => w.status === 'blocked' || w.status === 'failed').length,
      inProgress: items.filter(w => w.status === 'now' || w.status === 'delegated').length
    };
  });
  return { departments, unassigned: workflows.filter(w => !assigned.has(w.id)) };
}
