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

class FailClosedAdapter implements HospitalityAccessAdapter {
  readonly providerType: HospitalityProviderType;
  readonly capabilities: readonly HospitalityCapability[];

  constructor(providerType: HospitalityProviderType, capabilities: readonly HospitalityCapability[]) {
    this.providerType = providerType;
    this.capabilities = capabilities;
  }

  async readiness(_context: ProviderContext): Promise<ProviderReadiness> {
    return {
      state: 'configured_unverified',
      blocker: 'provider_adapter_not_implemented',
      checkedAt: new Date().toISOString(),
      capabilities: this.capabilities
    };
  }

  async issueCredential(
    _context: ProviderContext,
    _request: IssueCredentialRequest
  ): Promise<IssueCredentialResult> {
    throw hospitalityError('provider_not_ready', 503, { blocker: 'provider_adapter_not_implemented' });
  }

  async revokeCredential(
    _context: ProviderContext,
    _request: RevokeCredentialRequest
  ): Promise<RevokeCredentialResult> {
    throw hospitalityError('provider_not_ready', 503, { blocker: 'provider_adapter_not_implemented' });
  }
}

export function providerFor(instance: ProviderInstanceRecord): HospitalityAccessAdapter {
  if (!instance?.provider_type || instance.state === 'not_configured' || instance.state === 'disabled') {
    throw hospitalityError('provider_not_configured', 409);
  }

  const providerType = instance.provider_type as HospitalityProviderType;
  if (!KNOWN_PROVIDER_TYPES.has(providerType)) {
    throw hospitalityError('unsupported_provider_type', 422);
  }

  const capabilities = (instance.capabilities || []) as HospitalityCapability[];
  return new FailClosedAdapter(providerType, capabilities);
}
