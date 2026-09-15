export type HubSpotFetch = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

export type HubSpotOAuthErrorCode =
  | 'invalid_request'
  | 'invalid_client'
  | 'invalid_grant'
  | 'forbidden'
  | 'rate_limited'
  | 'upstream_unavailable'
  | 'malformed_response'
  | 'unknown_oauth_error';

export class HubSpotOAuthError extends Error {
  readonly code: HubSpotOAuthErrorCode;
  readonly status: number;
  readonly retryAfterSeconds?: number;

  constructor(input: {
    code: HubSpotOAuthErrorCode;
    status: number;
    retryAfterSeconds?: number;
  }) {
    super(`HubSpot OAuth request failed (${input.code})`);
    this.name = 'HubSpotOAuthError';
    this.code = input.code;
    this.status = input.status;
    this.retryAfterSeconds = input.retryAfterSeconds;
  }
}

export type HubSpotTokenResponse = {
  accessToken: string;
  refreshToken: string | null;
  tokenType: string;
  expiresIn: number;
  hubId: string | null;
  userId: string | null;
  scopes: string[];
};

export type HubSpotTokenIntrospection = {
  active: boolean;
  hubId: string | null;
  userId: string | null;
  clientId: string | null;
  hubDomain: string | null;
  scopes: string[];
  tokenUse: string | null;
  tokenType: string | null;
  expiresIn: number | null;
};

export type HubSpotTokenTypeHint = 'access_token' | 'refresh_token';

const AUTHORIZE_URL = 'https://app.hubspot.com/oauth/authorize';
const TOKEN_URL = 'https://api.hubapi.com/oauth/2026-03/token';
const INTROSPECT_URL = 'https://api.hubapi.com/oauth/2026-03/token/introspect';
const REVOKE_URL = 'https://api.hubapi.com/oauth/2026-03/token/revoke';

function required(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} is required`);
  return normalized;
}

function parseRetryAfter(response: Response): number | undefined {
  const value = response.headers.get('retry-after');
  if (!value) return undefined;
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : undefined;
}

function errorCodeForStatus(status: number): HubSpotOAuthErrorCode {
  if (status === 400) return 'invalid_request';
  if (status === 401) return 'invalid_client';
  if (status === 403) return 'forbidden';
  if (status === 429) return 'rate_limited';
  if (status >= 500) return 'upstream_unavailable';
  return 'unknown_oauth_error';
}

async function safeErrorCode(response: Response): Promise<HubSpotOAuthErrorCode> {
  const fallback = errorCodeForStatus(response.status);
  if (response.status !== 400) return fallback;

  try {
    const body = (await response.clone().json()) as { error?: unknown };
    if (body.error === 'invalid_client') return 'invalid_client';
    if (body.error === 'invalid_grant') return 'invalid_grant';
    if (body.error === 'invalid_request') return 'invalid_request';
  } catch {
    // Provider payloads are deliberately not surfaced in thrown errors.
  }
  return fallback;
}

async function postForm(
  url: string,
  values: Record<string, string>,
  fetchImpl: HubSpotFetch
): Promise<Response> {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) body.set(key, value);

  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString()
    });
  } catch {
    throw new HubSpotOAuthError({ code: 'upstream_unavailable', status: 0 });
  }

  if (!response.ok) {
    throw new HubSpotOAuthError({
      code: await safeErrorCode(response),
      status: response.status,
      retryAfterSeconds: parseRetryAfter(response)
    });
  }
  return response;
}

function stringOrNull(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

async function parseTokenResponse(response: Response): Promise<HubSpotTokenResponse> {
  let body: Record<string, unknown>;
  try {
    body = (await response.json()) as Record<string, unknown>;
  } catch {
    throw new HubSpotOAuthError({ code: 'malformed_response', status: response.status });
  }

  if (
    typeof body.access_token !== 'string' ||
    !body.access_token.trim() ||
    typeof body.expires_in !== 'number' ||
    !Number.isFinite(body.expires_in) ||
    body.expires_in <= 0
  ) {
    throw new HubSpotOAuthError({ code: 'malformed_response', status: response.status });
  }

  return {
    accessToken: body.access_token,
    refreshToken: stringOrNull(body.refresh_token),
    tokenType: stringOrNull(body.token_type) ?? 'Bearer',
    expiresIn: body.expires_in,
    hubId: stringOrNull(body.hub_id),
    userId: stringOrNull(body.user_id),
    scopes: stringArray(body.scopes)
  };
}

export function buildHubSpotAuthorizationUrl(input: {
  clientId: string;
  redirectUri: string;
  state: string;
  scopes: readonly string[];
  optionalScopes?: readonly string[];
}): string {
  const clientId = required(input.clientId, 'HubSpot client ID');
  const redirectUri = required(input.redirectUri, 'HubSpot redirect URI');
  const state = required(input.state, 'HubSpot OAuth state');
  const scopes = [...new Set(input.scopes.map((scope) => scope.trim()).filter(Boolean))];
  if (scopes.length === 0) throw new Error('At least one HubSpot OAuth scope is required');

  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('scope', scopes.join(' '));
  url.searchParams.set('state', state);

  const optionalScopes = [
    ...new Set((input.optionalScopes ?? []).map((scope) => scope.trim()).filter(Boolean))
  ];
  if (optionalScopes.length > 0) {
    url.searchParams.set('optional_scope', optionalScopes.join(' '));
  }
  return url.toString();
}

export async function exchangeHubSpotCode(input: {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  code: string;
  fetchImpl?: HubSpotFetch;
}): Promise<HubSpotTokenResponse> {
  const response = await postForm(
    TOKEN_URL,
    {
      grant_type: 'authorization_code',
      client_id: required(input.clientId, 'HubSpot client ID'),
      client_secret: required(input.clientSecret, 'HubSpot client secret'),
      redirect_uri: required(input.redirectUri, 'HubSpot redirect URI'),
      code: required(input.code, 'HubSpot authorization code')
    },
    input.fetchImpl ?? fetch
  );
  return parseTokenResponse(response);
}

export async function refreshHubSpotToken(input: {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  fetchImpl?: HubSpotFetch;
}): Promise<HubSpotTokenResponse> {
  const response = await postForm(
    TOKEN_URL,
    {
      grant_type: 'refresh_token',
      client_id: required(input.clientId, 'HubSpot client ID'),
      client_secret: required(input.clientSecret, 'HubSpot client secret'),
      refresh_token: required(input.refreshToken, 'HubSpot refresh token')
    },
    input.fetchImpl ?? fetch
  );
  return parseTokenResponse(response);
}

export async function introspectHubSpotToken(input: {
  clientId: string;
  clientSecret: string;
  token: string;
  tokenTypeHint: HubSpotTokenTypeHint;
  fetchImpl?: HubSpotFetch;
}): Promise<HubSpotTokenIntrospection> {
  const response = await postForm(
    INTROSPECT_URL,
    {
      client_id: required(input.clientId, 'HubSpot client ID'),
      client_secret: required(input.clientSecret, 'HubSpot client secret'),
      token: required(input.token, 'HubSpot token'),
      token_type_hint: input.tokenTypeHint
    },
    input.fetchImpl ?? fetch
  );

  let body: Record<string, unknown>;
  try {
    body = (await response.json()) as Record<string, unknown>;
  } catch {
    throw new HubSpotOAuthError({ code: 'malformed_response', status: response.status });
  }
  if (typeof body.active !== 'boolean') {
    throw new HubSpotOAuthError({ code: 'malformed_response', status: response.status });
  }

  return {
    active: body.active,
    hubId: stringOrNull(body.hub_id),
    userId: stringOrNull(body.user_id),
    clientId: stringOrNull(body.client_id),
    hubDomain: stringOrNull(body.hub_domain),
    scopes: stringArray(body.scopes),
    tokenUse: stringOrNull(body.token_use),
    tokenType: stringOrNull(body.token_type),
    expiresIn:
      typeof body.expires_in === 'number' && Number.isFinite(body.expires_in)
        ? body.expires_in
        : null
  };
}

export async function revokeHubSpotToken(input: {
  clientId: string;
  clientSecret: string;
  token: string;
  tokenTypeHint?: HubSpotTokenTypeHint;
  fetchImpl?: HubSpotFetch;
}): Promise<void> {
  await postForm(
    REVOKE_URL,
    {
      client_id: required(input.clientId, 'HubSpot client ID'),
      client_secret: required(input.clientSecret, 'HubSpot client secret'),
      token: required(input.token, 'HubSpot token'),
      token_type_hint: input.tokenTypeHint ?? 'refresh_token'
    },
    input.fetchImpl ?? fetch
  );
}
