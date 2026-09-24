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

export type OnityAdapterConfig = {
  providerType: 'onity';
  officialInterfaceConfigured: boolean;
};

class OnityAdapter implements HospitalityAccessAdapter {
  readonly providerType = 'onity' as const;
  readonly capabilities: readonly HospitalityCapability[] = [];
  private readonly config: OnityAdapterConfig;

  constructor(config: OnityAdapterConfig) {
    this.config = config;
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

export function createOnityAdapter(config: OnityAdapterConfig): HospitalityAccessAdapter {
  return new OnityAdapter(config);
}
