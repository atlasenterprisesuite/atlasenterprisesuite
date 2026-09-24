export type PayrollPermission =
  | 'payroll.read'
  | 'payroll.setup.write'
  | 'payroll.worker.read'
  | 'payroll.worker.write'
  | 'payroll.compensation.read'
  | 'payroll.compensation.write'
  | 'payroll.time.read'
  | 'payroll.time.write'
  | 'payroll.time.approve'
  | 'payroll.run.create'
  | 'payroll.run.approve'
  | 'payroll.run.process'
  | 'payroll.settings.write'
  | 'payroll.audit.read'
  | 'platform.billing.internal_comp.manage';

export type PayrollRoleKey =
  | 'organization_owner'
  | 'payroll_admin'
  | 'payroll_approver'
  | 'payroll_processor'
  | 'payroll_manager'
  | 'payroll_viewer';

const ALL: readonly PayrollPermission[] = [
  'payroll.read','payroll.setup.write','payroll.worker.read','payroll.worker.write',
  'payroll.compensation.read','payroll.compensation.write','payroll.time.read',
  'payroll.time.write','payroll.time.approve','payroll.run.create','payroll.run.approve',
  'payroll.run.process','payroll.settings.write','payroll.audit.read',
  'platform.billing.internal_comp.manage'
];

const ROLE_PERMISSIONS: Record<PayrollRoleKey, readonly PayrollPermission[]> = {
  organization_owner: ALL,
  payroll_admin: ALL.filter((permission) => permission !== 'platform.billing.internal_comp.manage'),
  payroll_approver: ['payroll.read','payroll.worker.read','payroll.compensation.read','payroll.time.read','payroll.run.approve','payroll.audit.read'],
  payroll_processor: ['payroll.read','payroll.worker.read','payroll.compensation.read','payroll.time.read','payroll.run.create','payroll.run.process','payroll.audit.read'],
  payroll_manager: ['payroll.read','payroll.setup.write','payroll.worker.read','payroll.worker.write','payroll.compensation.read','payroll.time.read','payroll.time.write','payroll.time.approve','payroll.run.create','payroll.audit.read'],
  payroll_viewer: ['payroll.read','payroll.worker.read','payroll.time.read','payroll.audit.read']
};

export function hasPayrollPermission(role: PayrollRoleKey, permission: PayrollPermission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function canGrantPayrollPermission(role: PayrollRoleKey, permission: PayrollPermission): boolean {
  if (permission === 'platform.billing.internal_comp.manage') return role === 'organization_owner';
  return role === 'organization_owner' || role === 'payroll_admin';
}

export function permissionsForPayrollRole(role: PayrollRoleKey): readonly PayrollPermission[] {
  return ROLE_PERMISSIONS[role];
}
