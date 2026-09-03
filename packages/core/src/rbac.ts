export type AccountingPermission =
  | 'accounting.read'
  | 'accounting.write'
  | 'accounting.post'
  | 'accounting.close'
  | 'accounting.admin'
  | 'audit.read';

export function hasPermission(
  granted: readonly AccountingPermission[],
  required: AccountingPermission,
): boolean {
  return granted.includes(required) || granted.includes('accounting.admin');
}
