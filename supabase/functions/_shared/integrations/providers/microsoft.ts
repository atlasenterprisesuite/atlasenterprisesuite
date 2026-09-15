import type { IntegrationCapability } from '../../../../../packages/integrations/types.ts';
import { IntegrationEdgeError, integrationError } from '../context.ts';

export const microsoftDefaultScopes = ['openid', 'profile', 'email', 'offline_access', 'User.Read'] as const;

const capabilityScopes: Partial<Record<IntegrationCapability, readonly string[]>> = {
  'microsoft.profile.read': ['User.Read'],
  'microsoft.mail.read': ['Mail.Read'],
  'microsoft.calendar.read': ['Calendars.Read'],
  'microsoft.files.read': ['Files.Read']
};

export function scopesForCapabilities(capabilities: readonly IntegrationCapability[]) {
  const scopes = new Set<string>(microsoftDefaultScopes);
  for (const capability of capabilities) {
    for (const scope of capabilityScopes[capability] || []) scopes.add(scope);
  }
  return [...scopes];
}

type MicrosoftConfig = {
  clientId: string;
  clientSecret?: string;
  redirectUri: string;
  tenant?: string;
};

type TokenPayload = {
  accessToken: string;
  refreshToken: string | null;
  tokenType: string;
  scopes: string[];
  expiresAt: number | null;
};

type MicrosoftIdentity = {
  externalSubjectId: string;
  maskedIdentity: string;
  displayName: string;
  verifiedAt: string;
  scopes: string[];
};

function required(value: string | undefined, code: string) {
  const normalized = String(value || '').trim();
  if (!normalized) throw integrationError(code, 503);
  return normalized;
}

function maskIdentity(value: string) {
  const trimmed = value.trim();
  const at = trimmed.indexOf('@');
  if (at < 1) return trimmed ? `${trimmed.slice(0, 1)}***` : '***';
  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1);
  const visibleEnd = local.length > 2 ? local.slice(-1) : '';
  return `${local.slice(0, 1)}***${visibleEnd}@${domain}`;
}

function identityFromGraph(payload: any, scopes: string[]): MicrosoftIdentity {
  const id = String(payload?.id || '').trim();
  if (!id) throw integrationError('microsoft_identity_invalid', 502);
  const identity = String(payload?.mail || payload?.userPrincipalName || id);
  return {
    externalSubjectId: id,
    maskedIdentity: maskIdentity(identity),
    displayName: String(payload?.displayName || 'Microsoft account'),
    verifiedAt: new Date().toISOString(),
    scopes: [...new Set(scopes)]
  };
}

function expiresAt(expiresIn: unknown) {
  const seconds = Number(expiresIn);
  return Number.isFinite(seconds) && seconds > 0 ? Date.now() + seconds * 1000 : null;
}

export function createMicrosoftAdapter(config: MicrosoftConfig, fetchFn: typeof fetch = fetch) {
  const clientId = required(config.clientId, 'provider_not_configured');
  const redirectUri = required(config.redirectUri, 'provider_not_configured');
  const tenant = String(config.tenant || 'common').trim() || 'common';
  const authority = `https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0`;
  const graphBase = 'https://graph.microsoft.com/v1.0';

  async function requestToken(params: URLSearchParams): Promise<TokenPayload> {
    params.set('client_id', clientId);
    params.set('redirect_uri', redirectUri);
    if (config.clientSecret) params.set('client_secret', config.clientSecret);

    let response: Response;
    try {
      response = await fetchFn(`${authority}/token`, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
        cache: 'no-store'
      });
    } catch {
      throw integrationError('microsoft_provider_unavailable', 502);
    }

    let payload: any = {};
    try { payload = await response.json(); } catch { payload = {}; }
    if (!response.ok) {
      const code = response.status === 429 ? 'microsoft_rate_limited'
        : response.status === 401 || response.status === 403 ? 'microsoft_authorization_failed'
        : 'microsoft_token_exchange_failed';
      throw integrationError(code, response.status === 429 ? 429 : 502);
    }

    const accessToken = String(payload?.access_token || '').trim();
    if (!accessToken) throw integrationError('microsoft_token_response_invalid', 502);
    return {
      accessToken,
      refreshToken: payload?.refresh_token ? String(payload.refresh_token) : null,
      tokenType: String(payload?.token_type || 'Bearer'),
      scopes: String(payload?.scope || '').split(/\s+/).filter(Boolean),
      expiresAt: expiresAt(payload?.expires_in)
    };
  }

  async function graphMe(accessToken: string, scopes: string[]) {
    let response: Response;
    try {
      response = await fetchFn(`${graphBase}/me?$select=id,displayName,userPrincipalName,mail`, {
        method: 'GET',
        headers: { authorization: `Bearer ${accessToken}`, accept: 'application/json' },
        cache: 'no-store'
      });
    } catch {
      throw integrationError('microsoft_provider_unavailable', 502);
    }
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) throw integrationError('microsoft_reconnect_required', 401);
      if (response.status === 429) throw integrationError('microsoft_rate_limited', 429);
      throw integrationError('microsoft_provider_error', 502);
    }
    let payload: any;
    try { payload = await response.json(); } catch { throw integrationError('microsoft_response_invalid', 502); }
    return identityFromGraph(payload, scopes);
  }

  return {
    authorizationUrl(input: {
      state: string;
      codeChallenge: string;
      capabilities: readonly IntegrationCapability[];
    }) {
      const url = new URL(`${authority}/authorize`);
      url.searchParams.set('client_id', clientId);
      url.searchParams.set('response_type', 'code');
      url.searchParams.set('redirect_uri', redirectUri);
      url.searchParams.set('response_mode', 'query');
      url.searchParams.set('scope', scopesForCapabilities(input.capabilities).join(' '));
      url.searchParams.set('state', input.state);
      url.searchParams.set('code_challenge', input.codeChallenge);
      url.searchParams.set('code_challenge_method', 'S256');
      return url.toString();
    },

    exchangeCode(input: { code: string; codeVerifier: string; capabilities: readonly IntegrationCapability[] }) {
      return requestToken(new URLSearchParams({
        grant_type: 'authorization_code',
        code: input.code,
        code_verifier: input.codeVerifier,
        scope: scopesForCapabilities(input.capabilities).join(' ')
      }));
    },

    refresh(input: { refreshToken: string; capabilities: readonly IntegrationCapability[] }) {
      return requestToken(new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: input.refreshToken,
        scope: scopesForCapabilities(input.capabilities).join(' ')
      }));
    },

    verify(input: { accessToken: string; scopes: string[] }) {
      return graphMe(input.accessToken, input.scopes);
    },

    async executeCapability(input: {
      capability: IntegrationCapability;
      accessToken: string;
      scopes: string[];
    }) {
      const requiredScopes = capabilityScopes[input.capability];
      if (!requiredScopes) throw integrationError('integration_capability_not_supported', 409);
      if (!requiredScopes.every((scope) => input.scopes.includes(scope))) {
        throw integrationError('integration_provider_scope_missing', 409);
      }
      if (input.capability === 'microsoft.profile.read') {
        return graphMe(input.accessToken, input.scopes);
      }
      throw integrationError('capability_not_implemented', 409);
    },

    revokeLocalAuthorization() {
      return {
        revokedLocally: true as const,
        providerManagementUrl: 'https://account.live.com/consent/Manage'
      };
    },

    sanitizeIdentity(payload: any, scopes: string[]) {
      return identityFromGraph(payload, scopes);
    },

    mapError(error: unknown) {
      if (error instanceof IntegrationEdgeError) {
        return { code: error.code, status: error.status };
      }
      return { code: 'microsoft_provider_error', status: 502 };
    }
  };
}
