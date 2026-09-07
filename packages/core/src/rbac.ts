export type AtlasPermission = string;

export type AccountingPermission =
  | 'accounting.read'
  | 'accounting.write'
  | 'accounting.post'
  | 'accounting.close'
  | 'accounting.admin'
  | 'audit.read';

export type ForgePermission =
  | 'forge.read'
  | 'forge.repository.read'
  | 'forge.repository.write'
  | 'forge.pipeline.read'
  | 'forge.pipeline.execute'
  | 'forge.runner.read'
  | 'forge.runner.manage'
  | 'forge.artifact.read'
  | 'forge.release.read'
  | 'forge.release.approve'
  | 'forge.release.deploy'
  | 'forge.mirror.manage'
  | 'forge.admin';

export function hasPermission(granted: readonly AtlasPermission[], required: AtlasPermission): boolean {
  if (granted.includes(required)) return true;
  if (required.startsWith('accounting.')) return granted.includes('accounting.admin');
  if (required.startsWith('forge.')) return granted.includes('forge.admin');
  return false;
}
