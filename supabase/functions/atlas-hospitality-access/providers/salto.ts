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

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

type SaltoSpaceConfig = {
  providerType: 'salto_space_hospitality';
  baseUrl: string;
  bearerToken: string;
  probeRoomId: string;
};

type SaltoKsConfig = {
  providerType: 'salto_ks';
  baseUrl: string;
  bearerToken: string;
  siteId: string;
};

export type SaltoAdapterConfig = SaltoSpaceConfig | SaltoKsConfig;

function normalizeBaseUrl(value: string) {
  return value.trim().replace(/\/+$/, '');
}

function safeCapabilities(config: SaltoAdapterConfig): readonly HospitalityCapability[] {
  if (config.providerType === 'salto_space_hospitality') {
    return ['credential.revoke', 'credential.status', 'room.mapping.verify'];
  }
  return ['room.list', 'room.mapping.verify'];
}

function authHeaders(config: SaltoAdapterConfig) {
  return {
    authorization: `Bearer ${config.bearerToken}`,
    accept: 'application/json'
  };
}

async function safeJson(response: Response) {
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('application/json')) return null;
  return response.json().catch(() => null);
}

class SaltoAdapter implements HospitalityAccessAdapter {
  readonly providerType: SaltoAdapterConfig['providerType'];
  readonly capabilities: readonly HospitalityCapability[];
  private readonly config: SaltoAdapterConfig;
  private readonly fetchImpl: FetchLike;

  constructor(config: SaltoAdapterConfig, fetchImpl: FetchLike) {
    this.config = { ...config, baseUrl: normalizeBaseUrl(config.baseUrl) } as SaltoAdapterConfig;
    this.providerType = config.providerType;
    this.capabilities = safeCapabilities(config);
    this.fetchImpl = fetchImpl;
  }

  async readiness(_context: ProviderContext): Promise<ProviderReadiness> {
    if (!this.config.baseUrl || !this.config.bearerToken) {
      return {
        state: 'configured_unverified',
        blocker: 'salto_configuration_required',
        checkedAt: new Date().toISOString(),
        capabilities: this.capabilities
      };
    }

    try {
      if (this.config.providerType === 'salto_space_hospitality') {
        if (!this.config.probeRoomId) {
          return {
            state: 'configured_unverified',
            blocker: 'salto_space_probe_room_required',
            checkedAt: new Date().toISOString(),
            capabilities: this.capabilities
          };
        }

        const response = await this.fetchImpl(
          `${this.config.baseUrl}/v1/rooms/${encodeURIComponent(this.config.probeRoomId)}/keys`,
          { method: 'GET', headers: authHeaders(this.config) }
        );

        if (response.status === 401 || response.status === 403) {
          return {
            state: 'degraded',
            blocker: 'provider_authentication_failed',
            checkedAt: new Date().toISOString(),
            capabilities: this.capabilities,
            providerStatusCode: response.status
          };
        }
        if (!response.ok) {
          return {
            state: 'degraded',
            blocker: 'provider_probe_failed',
            checkedAt: new Date().toISOString(),
            capabilities: this.capabilities,
            providerStatusCode: response.status
          };
        }

        await safeJson(response);
        return {
          state: 'degraded',
          blocker: 'salto_space_issue_contract_unverified',
          checkedAt: new Date().toISOString(),
          capabilities: this.capabilities,
          providerStatusCode: response.status
        };
      }

      if (!this.config.siteId) {
        return {
          state: 'configured_unverified',
          blocker: 'salto_ks_site_required',
          checkedAt: new Date().toISOString(),
          capabilities: this.capabilities
        };
      }

      const response = await this.fetchImpl(`${this.config.baseUrl}/v1.2/sites`, {
        method: 'GET',
        headers: authHeaders(this.config)
      });

      if (response.status === 401 || response.status === 403) {
        return {
          state: 'degraded',
          blocker: 'provider_authentication_failed',
          checkedAt: new Date().toISOString(),
          capabilities: this.capabilities,
          providerStatusCode: response.status
        };
      }
      if (!response.ok) {
        return {
          state: 'degraded',
          blocker: 'provider_probe_failed',
          checkedAt: new Date().toISOString(),
          capabilities: this.capabilities,
          providerStatusCode: response.status
        };
      }

      const payload: any = await safeJson(response);
      const sites = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.items)
          ? payload.items
          : Array.isArray(payload?.value)
            ? payload.value
            : [];
      const siteVisible = sites.some((site: any) => String(site?.id || site?.site_id || '') === this.config.siteId);

      return {
        state: 'degraded',
        blocker: siteVisible
          ? 'salto_ks_room_credential_mapping_required'
          : 'salto_ks_site_not_accessible',
        checkedAt: new Date().toISOString(),
        capabilities: this.capabilities,
        providerStatusCode: response.status
      };
    } catch {
      return {
        state: 'offline',
        blocker: 'provider_unreachable',
        checkedAt: new Date().toISOString(),
        capabilities: this.capabilities
      };
    }
  }

  async issueCredential(
    _context: ProviderContext,
    _request: IssueCredentialRequest
  ): Promise<IssueCredentialResult> {
    const blocker = this.config.providerType === 'salto_space_hospitality'
      ? 'salto_space_issue_contract_unverified'
      : 'salto_ks_room_credential_mapping_required';
    throw hospitalityError('provider_not_ready', 503, { blocker });
  }

  async revokeCredential(
    _context: ProviderContext,
    _request: RevokeCredentialRequest
  ): Promise<RevokeCredentialResult> {
    const blocker = this.config.providerType === 'salto_space_hospitality'
      ? 'salto_space_credential_lifecycle_contract_unverified'
      : 'salto_ks_room_credential_mapping_required';
    throw hospitalityError('provider_not_ready', 503, { blocker });
  }
}

export function createSaltoAdapter(
  config: SaltoAdapterConfig,
  fetchImpl: FetchLike = fetch
): HospitalityAccessAdapter {
  return new SaltoAdapter(config, fetchImpl);
}
