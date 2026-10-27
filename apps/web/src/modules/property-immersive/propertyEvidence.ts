export type Provenance = 'verified' | 'estimated' | 'simulated';
export type PropertyAsset = { id: string; status: Provenance; sourceUrl?: string; capturedAt?: string; license?: string };
export function classifyAsset<T extends PropertyAsset>(asset: T): T {
  if (!asset.id || !['verified','estimated','simulated'].includes(asset.status)) throw new Error('INVALID_ASSET');
  if (asset.status === 'verified' && (!asset.sourceUrl?.startsWith('https://') || !asset.capturedAt || !asset.license)) throw new Error('MISSING_VERIFICATION');
  return asset;
}
export function canPublishGeometry(asset: PropertyAsset, requested: Provenance): boolean {
  try { classifyAsset(asset); } catch { return false; }
  return requested === 'verified' ? asset.status === 'verified' : true;
}
export function assertTenant(expected: string, actual: string): void {
  if (!expected || !actual || expected !== actual) throw new Error('TENANT_DENIED');
}
export function tourStops(assets: PropertyAsset[], requestedIds: string[]): PropertyAsset[] {
  const requested = new Set(requestedIds);
  return assets.filter(asset => requested.has(asset.id) && canPublishGeometry(asset, asset.status));
}
export const EMERALD_GROVE_DEMO = {
  name: 'Emerald Grove — simulated walkthrough',
  locationLabel: '13501 Vista Walk Dr, Orlando, FL 32821',
  geometryStatus: 'simulated' as const,
  note: 'All building placement, apartment interiors and camera paths are illustrative until source-backed geometry is obtained.'
};
