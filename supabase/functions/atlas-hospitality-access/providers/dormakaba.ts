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

type DormakabaProviderType =
  | 'dormakaba_ambiance_cloud'
  | 'dormakaba_ambiance_soap'
  | 'dormakaba_ambiance_rest'
  | 'dormakaba_pms_bridge';

export type DormakabaAdapterConfig = {
  providerType: DormakabaProviderType;
  officialInterfaceConfigured: boolean;
};

class DormakabaAdapter implements HospitalityAccessAdapter {
  readonly providerType: DormakabaProviderType;
  readonly capabilities: readonly HospitalityCapability[] = [];
  private readonly config: DormakabaAdapterConfig;

  constructor(config: DormakabaAdapterConfig) {
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

export function createDormakabaAdapter(config: DormakabaAdapterConfig): HospitalityAccessAdapter {
  return new DormakabaAdapter(config);
}
