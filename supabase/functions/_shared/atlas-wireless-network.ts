export const ATLAS_WIRELESS_NETWORK_MODES = [
  'atlas-owned',
  'hybrid',
  'wholesale-fallback'
] as const;

export type AtlasWirelessNetworkMode = (typeof ATLAS_WIRELESS_NETWORK_MODES)[number];

export const ATLAS_WIRELESS_COMPONENT_STATES = [
  'not_configured',
  'planned',
  'configured_unverified',
  'ready',
  'degraded',
  'offline',
  'disabled'
] as const;

export type AtlasWirelessComponentState = (typeof ATLAS_WIRELESS_COMPONENT_STATES)[number];

export type AtlasWirelessNetworkLayer =
  | 'core'
  | 'ran'
  | 'spectrum'
  | 'backhaul'
  | 'edge'
  | 'sim_esim'
  | 'interconnect'
  | 'emergency_services'
  | 'observability';

export interface AtlasWirelessEvidenceRef {
  organizationId: string;
  reference: string;
}

export interface AtlasWirelessComponentReadiness {
  organizationId: string;
  layer: AtlasWirelessNetworkLayer;
  state: AtlasWirelessComponentState;
  blocker: string | null;
  checkedAt: string;
  evidenceRefs: readonly AtlasWirelessEvidenceRef[];
}

export interface AtlasWirelessOwnedNetworkReadiness {
  organizationId: string;
  serviceProvider: 'atlas-wireless';
  networkMode: AtlasWirelessNetworkMode;
  labReady: boolean;
  technicalPublicReady: boolean;
  blockers: readonly string[];
  components: readonly AtlasWirelessComponentReadiness[];
}

export interface AtlasWirelessLaunchAuthorization {
  organizationId: string;
  commercialAuthorized: boolean;
  regulatoryAuthorized: boolean;
  billingAndTaxReady: boolean;
  stagingVerified: boolean;
  endToEndVerified: boolean;
  checkedAt: string;
  evidenceRefs: readonly AtlasWirelessEvidenceRef[];
}

export interface AtlasWirelessReadinessOptions {
  nowMs?: number;
  maxAgeMs?: number;
  wholesaleProviderReady?: boolean;
}

export const ATLAS_WIRELESS_MAX_READINESS_AGE_MS = 5 * 60 * 1000;

const LAB_REQUIRED: readonly AtlasWirelessNetworkLayer[] = [
  'core',
  'ran',
  'spectrum',
  'backhaul',
  'observability'
];

const PUBLIC_REQUIRED: readonly AtlasWirelessNetworkLayer[] = [
  ...LAB_REQUIRED,
  'sim_esim',
  'interconnect',
  'emergency_services'
];

function nonBlank(value: string): boolean {
  return value.trim().length > 0;
}

function checkedAtIsFresh(
  checkedAt: string,
  nowMs: number,
  maxAgeMs: number
): boolean {
  const checkedAtMs = Date.parse(checkedAt);
  return Number.isFinite(checkedAtMs) &&
    checkedAtMs <= nowMs &&
    nowMs - checkedAtMs <= maxAgeMs;
}

function evidenceIsUsable(
  organizationId: string,
  evidenceRefs: readonly AtlasWirelessEvidenceRef[]
): boolean {
  return evidenceRefs.some((evidence) =>
    evidence.organizationId === organizationId && nonBlank(evidence.reference)
  );
}

function componentIndex(
  organizationId: string,
  components: readonly AtlasWirelessComponentReadiness[]
): {
  byLayer: ReadonlyMap<AtlasWirelessNetworkLayer, AtlasWirelessComponentReadiness>;
  blockers: string[];
} {
  const byLayer = new Map<AtlasWirelessNetworkLayer, AtlasWirelessComponentReadiness>();
  const blockers: string[] = [];

  for (const component of components) {
    if (component.organizationId !== organizationId) {
      blockers.push(`organization_mismatch:${component.layer}`);
      continue;
    }

    if (byLayer.has(component.layer)) {
      blockers.push(`duplicate_layer:${component.layer}`);
      continue;
    }

    byLayer.set(component.layer, component);
  }

  return { byLayer, blockers };
}

function missingOrUnready(
  organizationId: string,
  required: readonly AtlasWirelessNetworkLayer[],
  components: ReadonlyMap<AtlasWirelessNetworkLayer, AtlasWirelessComponentReadiness>,
  nowMs: number,
  maxAgeMs: number
): string[] {
  const blockers: string[] = [];

  for (const layer of required) {
    const component = components.get(layer);

    if (!component) {
      blockers.push(`missing:${layer}`);
      continue;
    }

    if (component.state !== 'ready') {
      blockers.push(component.blocker || `not_ready:${layer}:${component.state}`);
      continue;
    }

    if (!checkedAtIsFresh(component.checkedAt, nowMs, maxAgeMs)) {
      blockers.push(`stale_verification:${layer}`);
      continue;
    }

    if (!evidenceIsUsable(organizationId, component.evidenceRefs)) {
      blockers.push(`evidence_required:${layer}`);
    }
  }

  return blockers;
}

function wholesaleModeBlockers(
  networkMode: AtlasWirelessNetworkMode,
  wholesaleProviderReady: boolean
): string[] {
  if (networkMode === 'atlas-owned') return [];
  return wholesaleProviderReady ? [] : ['mvno_provider_readiness_required'];
}

export function evaluateAtlasOwnedNetworkReadiness(
  organizationId: string,
  networkMode: AtlasWirelessNetworkMode,
  components: readonly AtlasWirelessComponentReadiness[],
  options: AtlasWirelessReadinessOptions = {}
): AtlasWirelessOwnedNetworkReadiness {
  const nowMs = options.nowMs ?? Date.now();
  const maxAgeMs = options.maxAgeMs ?? ATLAS_WIRELESS_MAX_READINESS_AGE_MS;
  const indexed = componentIndex(organizationId, components);
  const sharedBlockers = indexed.blockers;
  const labBlockers = [
    ...sharedBlockers,
    ...missingOrUnready(organizationId, LAB_REQUIRED, indexed.byLayer, nowMs, maxAgeMs)
  ];
  const publicBlockers = [
    ...sharedBlockers,
    ...missingOrUnready(organizationId, PUBLIC_REQUIRED, indexed.byLayer, nowMs, maxAgeMs),
    ...wholesaleModeBlockers(networkMode, options.wholesaleProviderReady === true)
  ];

  return {
    organizationId,
    serviceProvider: 'atlas-wireless',
    networkMode,
    labReady: labBlockers.length === 0,
    technicalPublicReady: publicBlockers.length === 0,
    blockers: publicBlockers,
    components
  };
}

function launchAuthorizationBlockers(
  organizationId: string,
  authorization: AtlasWirelessLaunchAuthorization,
  nowMs: number,
  maxAgeMs: number
): string[] {
  const blockers: string[] = [];

  if (authorization.organizationId !== organizationId) {
    blockers.push('launch_authorization_organization_mismatch');
  }
  if (!authorization.commercialAuthorized) blockers.push('commercial_authorization_required');
  if (!authorization.regulatoryAuthorized) blockers.push('regulatory_authorization_required');
  if (!authorization.billingAndTaxReady) blockers.push('billing_tax_readiness_required');
  if (!authorization.stagingVerified) blockers.push('staging_verification_required');
  if (!authorization.endToEndVerified) blockers.push('end_to_end_verification_required');
  if (!checkedAtIsFresh(authorization.checkedAt, nowMs, maxAgeMs)) {
    blockers.push('launch_authorization_stale');
  }
  if (!evidenceIsUsable(organizationId, authorization.evidenceRefs)) {
    blockers.push('launch_authorization_evidence_required');
  }

  return blockers;
}

export function assertAtlasPublicWirelessActivationAllowed(
  organizationId: string,
  networkMode: AtlasWirelessNetworkMode,
  components: readonly AtlasWirelessComponentReadiness[],
  authorization: AtlasWirelessLaunchAuthorization,
  options: AtlasWirelessReadinessOptions = {}
): void {
  const nowMs = options.nowMs ?? Date.now();
  const maxAgeMs = options.maxAgeMs ?? ATLAS_WIRELESS_MAX_READINESS_AGE_MS;
  const readiness = evaluateAtlasOwnedNetworkReadiness(
    organizationId,
    networkMode,
    components,
    { ...options, nowMs, maxAgeMs }
  );

  const blockers = [
    ...readiness.blockers,
    ...launchAuthorizationBlockers(organizationId, authorization, nowMs, maxAgeMs)
  ];

  if (!readiness.technicalPublicReady || blockers.length > 0) {
    throw new Error(`atlas_wireless_public_service_blocked:${blockers.join(',')}`);
  }
}

export interface AtlasRanSite {
  id: string;
  organizationId: string;
  name: string;
  latitude: number;
  longitude: number;
  radioTechnology: '5g-nr' | 'lte';
  spectrumAccess: 'cbrs-gaa' | 'cbrs-pal' | 'licensed' | 'unlicensed-lab';
  state: AtlasWirelessComponentState;
  evidenceRefs: readonly AtlasWirelessEvidenceRef[];
}

export interface AtlasCoreNetworkProfile {
  id: string;
  organizationId: string;
  architecture: '5g-sa' | '5g-nsa' | 'lte-epc';
  amfSmfUpfReady: boolean;
  subscriberDataReady: boolean;
  policyControlReady: boolean;
  lawfulAndEmergencyBoundaryVerified: boolean;
  state: AtlasWirelessComponentState;
  evidenceRefs: readonly AtlasWirelessEvidenceRef[];
}

export interface AtlasSpectrumAuthorization {
  id: string;
  organizationId: string;
  accessModel: 'cbrs-gaa' | 'cbrs-pal' | 'licensed' | 'experimental';
  authority: string;
  authorizationReference: string | null;
  sasProvider: string | null;
  state: AtlasWirelessComponentState;
  evidenceRefs: readonly AtlasWirelessEvidenceRef[];
}

export interface AtlasBackhaulLink {
  id: string;
  organizationId: string;
  provider: string;
  medium: 'fiber' | 'ethernet' | 'microwave' | 'fixed-wireless' | 'satellite';
  redundant: boolean;
  state: AtlasWirelessComponentState;
  evidenceRefs: readonly AtlasWirelessEvidenceRef[];
}

export interface AtlasWirelessNetworkAdapter {
  readonly adapterId: string;
  readonly mode: AtlasWirelessNetworkMode;

  readiness(organizationId: string): Promise<AtlasWirelessOwnedNetworkReadiness>;
  listRanSites(organizationId: string): Promise<readonly AtlasRanSite[]>;
  listSpectrumAuthorizations(organizationId: string): Promise<readonly AtlasSpectrumAuthorization[]>;
  listBackhaulLinks(organizationId: string): Promise<readonly AtlasBackhaulLink[]>;
  getCoreProfile(organizationId: string): Promise<AtlasCoreNetworkProfile | null>;
}
