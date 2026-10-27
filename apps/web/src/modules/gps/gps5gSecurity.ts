import { assertTenant, classifyAsset, type Provenance } from '../property-immersive/propertyEvidence';

export type GpsSessionRequest = {
  tenantId: string; actorTenantId: string; locationConsent: boolean;
  permissionActive: boolean; costApproved: boolean; paidProvider?: boolean;
};
export function authorizeGpsSession(input: GpsSessionRequest): void {
  assertTenant(input.tenantId, input.actorTenantId);
  if (!input.locationConsent || !input.permissionActive) throw new Error('LOCATION_PERMISSION_DENIED');
  if (input.paidProvider && !input.costApproved) throw new Error('PAID_PROVIDER_DENIED');
}
export type Position = { lat: number; lon: number; accuracyM: number };
export function validatePosition(position: Position): Position {
  if (![position.lat, position.lon, position.accuracyM].every(Number.isFinite)
    || Math.abs(position.lat) > 90 || Math.abs(position.lon) > 180
    || position.accuracyM < 0) throw new Error('INVALID_GPS_POSITION');
  return position;
}
export function validateGeoAsset(asset: {
  status: Provenance; sourceUrl?: string; capturedAt?: string; license?: string;
}) {
  return classifyAsset({ id: 'gps-geometry', ...asset });
}
export type NetworkObservation = { online: boolean; effectiveType?: string; saveData?: boolean };
export type RenderQuality = 'offline-2d' | 'standard-2d' | 'enhanced-3d';
export function chooseRenderQuality(network: NetworkObservation): RenderQuality {
  if (!network.online) return 'offline-2d';
  if (network.saveData || !network.effectiveType || ['slow-2g', '2g', '3g'].includes(network.effectiveType)) return 'standard-2d';
  return network.effectiveType === '4g' ? 'enhanced-3d' : 'standard-2d';
}
