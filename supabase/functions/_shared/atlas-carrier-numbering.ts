export const ATLAS_NUMBERING_AUTH_STATES = [
  'not_started',
  'partner_path',
  'fcc_application_pending',
  'fcc_authorized',
  'nanpa_ready',
  'suspended',
  'revoked'
] as const;

export type AtlasNumberingAuthorizationState =
  (typeof ATLAS_NUMBERING_AUTH_STATES)[number];

export const ATLAS_NUMBER_RESOURCE_STATES = [
  'unavailable',
  'reserved',
  'assigned',
  'active',
  'suspended',
  'released'
] as const;

export type AtlasNumberResourceState =
  (typeof ATLAS_NUMBER_RESOURCE_STATES)[number];

export type AtlasNumberingMode = 'partner' | 'direct';

export interface AtlasNumberingAuthorization {
  organizationId: string;
  mode: AtlasNumberingMode;
  state: AtlasNumberingAuthorizationState;
  authorityReference: string | null;
  ocn: string | null;
  spid: string | null;
  facilitiesReady: boolean;
  e911Ready: boolean;
  robocallMitigationReady: boolean;
  checkedAt: string;
}

export interface AtlasNumberResource {
  id: string;
  organizationId: string;
  e164: string;
  countryCode: 'US';
  areaCode: string;
  rateCenter: string | null;
  state: AtlasNumberResourceState;
  upstreamProvider: string | null;
  externalResourceId: string | null;
  assignedService: 'communication' | 'wireless' | 'fax' | 'other' | null;
  verifiedAt: string | null;
}

export function canProvisionAtlasNumber(
  authorization: AtlasNumberingAuthorization
): boolean {
  if (authorization.mode === 'partner') {
    return authorization.state === 'partner_path' && authorization.e911Ready;
  }

  return (
    authorization.state === 'nanpa_ready' &&
    authorization.facilitiesReady &&
    authorization.e911Ready &&
    authorization.robocallMitigationReady
  );
}

export function assertAtlasNumberProvisioningAllowed(
  authorization: AtlasNumberingAuthorization
): void {
  if (!canProvisionAtlasNumber(authorization)) {
    throw new Error('atlas_numbering_not_authorized');
  }
}
