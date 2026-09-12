import type {
  HospitalityAccessAdapter,
  HospitalityCapability,
  HospitalityProviderType,
  IssueCredentialRequest,
  IssueCredentialResult,
  ProviderContext,
  ProviderReadiness,
  RevokeCredentialRequest,
  RevokeCredentialResult
} from '../../../../packages/hospitality/types.ts';
import { createDormakabaAdapter, type DormakabaAdapterConfig } from '../providers/dormakaba.ts';
import { createGenericCertifiedAdapter, type GenericCertifiedAdapterConfig } from '../providers/generic.ts';
import { createSaltoAdapter, type SaltoAdapterConfig } from '../providers/salto.ts';
import { createVingcardAdapter, type VingcardAdapterConfig } from '../providers/vingcard.ts';
import { hospitalityError } from './errors.ts';
import type { ProviderInstanceRecord } from './repository.ts';

const KNOWN_PROVIDER_TYPES = new Set<HospitalityProviderType>([
  'salto_ks',
  'salto_space_hospitality',
  'vingcard_vconnect',
  'vingcard_vostio',
  'vingcard_visionline',
  'dormakaba_ambiance_cloud',
  'dormakaba_ambiance_soap',
  'dormakaba_ambiance_rest',
  'dormakaba_pms_bridge',
  'generic_certified'
]);

type ProviderRuntimeConfig =
  | SaltoAdapterConfig
  | VingcardAdapterConfig
  | DormakabaAdapterConfig
  | GenericCertifiedAdapterConfig;

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

function envGet(name: string) {
  const deno = (globalThis as any)?.Deno;
  return typeof deno?.env?.get === 'function' ? String(deno.env.get(name) || '') : '';
}

function runtimeConfigFromEnvironment(instance: ProviderInstanceRecord): ProviderRuntimeConfig | undefined {
  const raw = envGet('ATLAS_HOSPITALITY_PROVIDER_CONFIG_JSON');
  if (!raw) return undefined;

  try {
    const parsed = JSON.parse(raw);
    const config = parsed?.[instance.id];
    if (!config || typeof config !== 'object') return undefined;
    return config as ProviderRuntimeConfig;
  } catch {
    throw hospitalityError('provider_runtime_configuration_invalid', 503);
  }
}

class MissingRuntimeConfigAdapter implements HospitalityAccessAdapter {
  readonly providerType: HospitalityProviderType;
  readonly capabilities: readonly HospitalityCapability[];

  constructor(providerType: HospitalityProviderType, capabilities: readonly HospitalityCapability[]) {
    this.providerType = providerType;
    this.capabilities = capabilities;
  }

  async readiness(_context: ProviderContext): Promise<ProviderReadiness> {
    return {
      state: 'configured_unverified',
      blocker: 'provider_runtime_configuration_required',
      checkedAt: new Date().toISOString(),
      capabilities: this.capabilities
    };
  }

  async issueCredential(
    _context: ProviderContext,
    _request: IssueCredentialRequest
  ): Promise<IssueCredentialResult> {
    throw hospitalityError('provider_not_ready', 503, { blocker: 'provider_runtime_configuration_required' });
  }

  async revokeCredential(
    _context: ProviderContext,
    _request: RevokeCredentialRequest
  ): Promise<RevokeCredentialResult> {
    throw hospitalityError('provider_not_ready', 503, { blocker: 'provider_runtime_configuration_required' });
  }
}

function ensureMatchingConfig(instance: ProviderInstanceRecord, config: ProviderRuntimeConfig) {
  if (config.providerType !== instance.provider_type) {
    throw hospitalityError('provider_configuration_mismatch', 409);
  }
}

export function providerFor(
  instance: ProviderInstanceRecord,
  runtimeConfig?: ProviderRuntimeConfig,
  fetchImpl: FetchLike = fetch
): HospitalityAccessAdapter {
  if (!instance?.provider_type) throw hospitalityError('provider_not_configured', 409);

  const providerType = instance.provider_type as HospitalityProviderType;
  if (!KNOWN_PROVIDER_TYPES.has(providerType)) {
    throw hospitalityError('unsupported_provider_type', 422);
  }
  if (instance.state === 'not_configured' || instance.state === 'disabled') {
    throw hospitalityError('provider_not_configured', 409);
  }

  const config = runtimeConfig || runtimeConfigFromEnvironment(instance);
  if (!config) {
    return new MissingRuntimeConfigAdapter(
      providerType,
      (instance.capabilities || []) as HospitalityCapability[]
    );
  }

  ensureMatchingConfig(instance, config);

  if (providerType === 'salto_ks' || providerType === 'salto_space_hospitality') {
    return createSaltoAdapter(config as SaltoAdapterConfig, fetchImpl);
  }
  if (providerType.startsWith('vingcard_')) {
    return createVingcardAdapter(config as VingcardAdapterConfig);
  }
  if (providerType.startsWith('dormakaba_')) {
    return createDormakabaAdapter(config as DormakabaAdapterConfig);
  }
  if (providerType === 'generic_certified') {
    return createGenericCertifiedAdapter(config as GenericCertifiedAdapterConfig);
  }

  throw hospitalityError('unsupported_provider_type', 422);
}
