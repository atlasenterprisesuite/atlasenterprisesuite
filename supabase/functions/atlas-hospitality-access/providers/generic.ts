import type {
  HospitalityAccessAdapter,
  HospitalityCapability,
  IssueCredentialRequest,
  IssueCredentialResult,
  ProviderContext,
  ProviderReadiness,
  RevokeCredentialRequest,
  RevokeCredentialResult
} from '../../../../packages/hospitality/types.ts';
import { hospitalityError } from '../_shared/errors.ts';

export type GenericCertifiedAdapterConfig = {
  providerType: 'generic_certified';
  officialInterfaceConfigured: boolean;
  declaredCapabilities?: readonly HospitalityCapability[];
};

class GenericCertifiedAdapter implements HospitalityAccessAdapter {
  readonly providerType = 'generic_certified' as const;
  readonly capabilities: readonly HospitalityCapability[];
  private readonly config: GenericCertifiedAdapterConfig;

  constructor(config: GenericCertifiedAdapterConfig) {
    this.config = config;
    this.capabilities = config.declaredCapabilities || [];
  }

  async readiness(_context: ProviderContext): Promise<ProviderReadiness> {
    return {
      state: 'configured_unverified',
      blocker: this.config.officialInterfaceConfigured
        ? 'official_provider_probe_required'
        : 'official_provider_interface_required',
      checkedAt: new Date().toISOString(),
      capabilities: this.capabilities
    };
  }

  async issueCredential(
    _context: ProviderContext,
    _request: IssueCredentialRequest
  ): Promise<IssueCredentialResult> {
    throw hospitalityError('provider_not_ready', 503, {
      blocker: this.config.officialInterfaceConfigured
        ? 'official_provider_probe_required'
        : 'official_provider_interface_required'
    });
  }

  async revokeCredential(
    _context: ProviderContext,
    _request: RevokeCredentialRequest
  ): Promise<RevokeCredentialResult> {
    throw hospitalityError('provider_not_ready', 503, {
      blocker: this.config.officialInterfaceConfigured
        ? 'official_provider_probe_required'
        : 'official_provider_interface_required'
    });
  }
}

export function createGenericCertifiedAdapter(
  config: GenericCertifiedAdapterConfig
): HospitalityAccessAdapter {
  return new GenericCertifiedAdapter(config);
}
