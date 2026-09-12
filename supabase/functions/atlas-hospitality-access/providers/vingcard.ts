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

type VingcardProviderType =
  | 'vingcard_vconnect'
  | 'vingcard_vostio'
  | 'vingcard_visionline';

export type VingcardAdapterConfig = {
  providerType: VingcardProviderType;
  officialInterfaceConfigured: boolean;
};

class VingcardAdapter implements HospitalityAccessAdapter {
  readonly providerType: VingcardProviderType;
  readonly capabilities: readonly HospitalityCapability[] = [];
  private readonly config: VingcardAdapterConfig;

  constructor(config: VingcardAdapterConfig) {
    this.config = config;
    this.providerType = config.providerType;
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

export function createVingcardAdapter(config: VingcardAdapterConfig): HospitalityAccessAdapter {
  return new VingcardAdapter(config);
}
