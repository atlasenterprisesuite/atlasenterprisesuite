export const HOSPITALITY_PROPERTY_TYPES = [
  'hotel',
  'resort',
  'restaurant',
  'mixed_use',
  'cafe',
  'bar'
] as const;

export type HospitalityPropertyType = (typeof HOSPITALITY_PROPERTY_TYPES)[number];

export const HOSPITALITY_OUTLET_TYPES = [
  'restaurant', 'bar', 'cafe', 'spa', 'shop', 'front_desk', 'banquet', 'room_service'
] as const;
export type HospitalityOutletType = (typeof HOSPITALITY_OUTLET_TYPES)[number];

export const HOSPITALITY_SPACE_TYPES = [
  'guest_room', 'table', 'meeting_room', 'event_space', 'kitchen_station', 'bar_station', 'pool_cabana', 'service_area'
] as const;
export type HospitalitySpaceType = (typeof HOSPITALITY_SPACE_TYPES)[number];

export const HOSPITALITY_OPERATIONAL_UNIT_TYPES = [
  'front_desk', 'housekeeping', 'food_and_beverage', 'maintenance', 'security', 'banquets', 'revenue_management', 'management'
] as const;
export type HospitalityOperationalUnitType = (typeof HOSPITALITY_OPERATIONAL_UNIT_TYPES)[number];
export type HospitalityEntityStatus = 'active' | 'inactive';

export type HospitalityBrand = { id: string; organizationId: string; name: string; status: HospitalityEntityStatus };
export type HospitalityProperty = { id: string; organizationId: string; brandId?: string | null; name: string; type: HospitalityPropertyType; status: HospitalityEntityStatus; timeZone: string };
export type HospitalityOutlet = { id: string; organizationId: string; propertyId: string; name: string; type: HospitalityOutletType; status: HospitalityEntityStatus };
export type HospitalitySpace = { id: string; organizationId: string; propertyId: string; outletId?: string | null; name: string; type: HospitalitySpaceType; status: HospitalityEntityStatus };
export type HospitalityOperationalUnit = { id: string; organizationId: string; propertyId: string; outletId?: string | null; name: string; type: HospitalityOperationalUnitType; status: HospitalityEntityStatus };
export type HospitalityPropertyContext = { organizationId: string; propertyId: string; outletId?: string | null };

export type HospitalityPermission =
  | 'hospitality.access.read' | 'hospitality.access.issue' | 'hospitality.access.revoke'
  | 'hospitality.access.configure' | 'hospitality.access.audit' | 'hospitality.access.admin'
  | 'hospitality.property.read' | 'hospitality.property.manage'
  | 'hospitality.reservation.read' | 'hospitality.reservation.manage'
  | 'hospitality.frontdesk.checkin' | 'hospitality.frontdesk.checkout'
  | 'hospitality.housekeeping.manage' | 'hospitality.maintenance.manage'
  | 'hospitality.restaurant.order.read' | 'hospitality.restaurant.order.manage' | 'hospitality.restaurant.refund'
  | 'hospitality.audit.read' | 'hospitality.audit.admin';

export const PROVIDER_STATES = ['not_configured','configured_unverified','ready','degraded','offline','disabled'] as const;
export type HospitalityProviderState = (typeof PROVIDER_STATES)[number];
export type HospitalityProviderType =
  | 'salto_ks' | 'salto_space_hospitality' | 'vingcard_vconnect' | 'vingcard_vostio' | 'vingcard_visionline'
  | 'dormakaba_ambiance_cloud' | 'dormakaba_ambiance_soap' | 'dormakaba_ambiance_rest' | 'dormakaba_pms_bridge'
  | 'onity' | 'generic_certified';
export type HospitalityCapability = 'credential.issue' | 'credential.revoke' | 'credential.status' | 'room.list' | 'room.mapping.verify' | 'mobile_key.issue' | 'rfid_reference.issue' | 'audit.read';
export type HospitalityActorContext = { organizationId: string; userId: string; permissions: readonly HospitalityPermission[] };
export type ProviderContext = { organizationId: string; propertyId: string; userId: string; providerInstanceId: string; providerPropertyId: string };
export type ProviderReadiness = { state: HospitalityProviderState; blocker: string | null; checkedAt: string; capabilities: readonly HospitalityCapability[]; providerStatusCode?: number | null };
export type RoomAccessReason = 'guest_checkin' | 'replacement' | 'staff_authorized';
export type RoomAccessRequest = { propertyId: string; roomId: string; assignmentReference: string; startsAt: string; expiresAt: string; reason: RoomAccessReason };
export type IssueCredentialRequest = RoomAccessRequest & { providerRoomId: string; credentialType?: 'mobile_key' | 'rfid_reference' };
export type IssueCredentialResult = { providerCredentialId: string; state: 'issued'; providerStatusCode?: number | null };
export type RevokeCredentialRequest = { providerCredentialId: string; propertyId: string; roomId: string; reason: string };
export type RevokeCredentialResult = { providerCredentialId: string; state: 'revoked'; providerStatusCode?: number | null };
export type CredentialStatusResult = { providerCredentialId: string; state: 'issued' | 'revoked' | 'expired' | 'failed' | 'unknown'; providerStatusCode?: number | null };
export interface HospitalityAccessAdapter {
  readonly providerType: HospitalityProviderType;
  readonly capabilities: readonly HospitalityCapability[];
  readiness(context: ProviderContext): Promise<ProviderReadiness>;
  issueCredential(context: ProviderContext, request: IssueCredentialRequest): Promise<IssueCredentialResult>;
  revokeCredential(context: ProviderContext, request: RevokeCredentialRequest): Promise<RevokeCredentialResult>;
  credentialStatus?(context: ProviderContext, providerCredentialId: string): Promise<CredentialStatusResult>;
}
