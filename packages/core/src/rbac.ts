export type AtlasPermission = string;

export type AccountingPermission =
  | 'accounting.read'
  | 'accounting.write'
  | 'accounting.post'
  | 'accounting.close'
  | 'accounting.admin'
  | 'audit.read';

export function hasPermission(
  granted: readonly AtlasPermission[],
  required: AtlasPermission,
): boolean {
  if (granted.includes(required)) return true;

  return required.startsWith('accounting.') && granted.includes('accounting.admin');
}
