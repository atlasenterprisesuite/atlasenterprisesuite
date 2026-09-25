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

export interface AtlasWirelessComponentReadiness {
  layer: AtlasWirelessNetworkLayer;
  state: AtlasWirelessComponentState;
  blocker: string | null;
  checkedAt: string;
  evidenceRefs: readonly string[];
}

export interface AtlasWirelessOwnedNetworkReadiness {
  serviceProvider: 'atlas-wireless';
  networkMode: AtlasWirelessNetworkMode;
  labReady: boolean;
  publicServiceReady: boolean;
  blockers: readonly string[];
  components: readonly AtlasWirelessComponentReadiness[];
}

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

function componentMap(
  components: readonly AtlasWirelessComponentReadiness[]
): ReadonlyMap<AtlasWirelessNetworkLayer, AtlasWirelessComponentReadiness> {
  return new Map(components.map((component) => [component.layer, component]));
}

function missingOrUnready(
  required: readonly AtlasWirelessNetworkLayer[],
  components: ReadonlyMap<AtlasWirelessNetworkLayer, AtlasWirelessComponentReadiness>
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
    if (component.evidenceRefs.length === 0) {
      blockers.push(`evidence_required:${layer}`);
    }
  }
  return blockers;
}

export function evaluateAtlasOwnedNetworkReadiness(
  networkMode: AtlasWirelessNetworkMode,
  components: readonly AtlasWirelessComponentReadiness[]
): AtlasWirelessOwnedNetworkReadiness {
  const byLayer = componentMap(components);
  const labBlockers = missingOrUnready(LAB_REQUIRED, byLayer);
  const publicBlockers = missingOrUnready(PUBLIC_REQUIRED, byLayer);

  return {
    serviceProvider: 'atlas-wireless',
    networkMode,
    labReady: labBlockers.length === 0,
    publicServiceReady: publicBlockers.length === 0,
    blockers: publicBlockers,
    components
  };
}

export function assertAtlasPublicWirelessActivationAllowed(
  readiness: AtlasWirelessOwnedNetworkReadiness
): void {
  if (!readiness.publicServiceReady) {
    throw new Error(`atlas_wireless_public_service_blocked:${readiness.blockers.join(',')}`);
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
  evidenceRefs: readonly string[];
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
  evidenceRefs: readonly string[];
}

export interface AtlasSpectrumAuthorization {
  id: string;
  organizationId: string;
  accessModel: 'cbrs-gaa' | 'cbrs-pal' | 'licensed' | 'experimental';
  authority: string;
  authorizationReference: string | null;
  sasProvider: string | null;
  state: AtlasWirelessComponentState;
  evidenceRefs: readonly string[];
}

export interface AtlasBackhaulLink {
  id: string;
  organizationId: string;
  provider: string;
  medium: 'fiber' | 'ethernet' | 'microwave' | 'fixed-wireless' | 'satellite';
  redundant: boolean;
  state: AtlasWirelessComponentState;
  evidenceRefs: readonly string[];
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
