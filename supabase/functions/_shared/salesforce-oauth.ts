export type SalesforceFetch = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

export type SalesforceOAuthErrorCode =
  | 'invalid_request'
  | 'invalid_client'
  | 'invalid_grant'
  | 'forbidden'
  | 'rate_limited'
  | 'upstream_unavailable'
  | 'malformed_response'
  | 'unknown_oauth_error';

export class SalesforceOAuthError extends Error {
  readonly code: SalesforceOAuthErrorCode;
  readonly status: number;
  readonly retryAfterSeconds?: number;

  constructor(input: {
    code: SalesforceOAuthErrorCode;
    status: number;
    retryAfterSeconds?: number;
  }) {
    super(`Salesforce OAuth request failed (${input.code})`);
    this.name = 'SalesforceOAuthError';
    this.code = input.code;
    this.status = input.status;
    this.retryAfterSeconds = input.retryAfterSeconds;
  }
}

export type SalesforceTokenResponse = {
  accessToken: string;
  refreshToken: string | null;
  tokenType: string;
  scopes: string[];
  instanceUrl: string;
  identityUrl: string;
  issuedAt: number | null;
};

export type SalesforceTokenIntrospection = {
  active: boolean;
  clientId: string | null;
  username: string | null;
  subject: string | null;
  scopes: string[];
  expiresAt: number | null;
};

const DEFAULT_LOGIN_BASE_URL = 'https://login.salesforce.com';

function required(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} is required`);
  return normalized;
}

export function normalizeSalesforceLoginBaseUrl(value?: string): string {
  const raw = value?.trim() || DEFAULT_LOGIN_BASE_URL;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('Salesforce login URL is invalid');
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) {
    throw new Error('Salesforce login URL must use HTTPS without credentials or a custom port');
  }
  const host = url.hostname.toLowerCase();
  const allowed =
    host === 'login.salesforce.com' ||
    host === 'test.salesforce.com' ||
    host.endsWith('.my.salesforce.com') ||
    host.endsWith('.sandbox.my.salesforce.com');
  if (!allowed) throw new Error('Salesforce login host is not allowed');
  return `${url.protocol}//${host}`;
}

export function normalizeSalesforceInstanceUrl(value: string): string {
  const url = new URL(required(value, 'Salesforce instance URL'));
  if (url.protocol !== 'https:' || url.username || url.password || url.port) {
    throw new Error('Salesforce instance URL is invalid');
  }
  const host = url.hostname.toLowerCase();
  if (!(host.endsWith('.salesforce.com') || host.endsWith('.force.com'))) {
    throw new Error('Salesforce instance host is not allowed');
  }
  return `${url.protocol}//${host}`;
}

function retryAfterSeconds(response: Response): number | undefined {
  const raw = response.headers.get('retry-after');
  if (!raw) return undefined;
  const seconds = Number(raw);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : undefined;
}

function statusCode(status: number): SalesforceOAuthErrorCode {
  if (status === 400) return 'invalid_request';
  if (status === 401) return 'invalid_client';
  if (status === 403) return 'forbidden';
  if (status === 429) return 'rate_limited';
  if (status >= 500 || status === 0) return 'upstream_unavailable';
  return 'unknown_oauth_error';
}

async function safeErrorCode(response: Response): Promise<SalesforceOAuthErrorCode> {
  let code = statusCode(response.status);
  try {
    const body = (await response.clone().json()) as { error?: unknown };
    if (body.error === 'invalid_client') code = 'invalid_client';
    if (body.error === 'invalid_grant') code = 'invalid_grant';
    if (body.error === 'invalid_request') code = 'invalid_request';
  } catch {
    // Provider details are intentionally not surfaced.
  }
  return code;
}

async function postForm(
  url: string,
  values: Record<string, string>,
  fetchImpl: SalesforceFetch
): Promise<Response> {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) body.set(key, value);

  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: body.toString()
    });
  } catch {
    throw new SalesforceOAuthError({ code: 'upstream_unavailable', status: 0 });
  }
  if (!response.ok) {
    throw new SalesforceOAuthError({
      code: await safeErrorCode(response),
      status: response.status,
      retryAfterSeconds: retryAfterSeconds(response)
    });
  }
  return response;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function scopes(value: unknown): string[] {
  if (typeof value !== 'string') return [];
  return [...new Set(value.split(/[\s,]+/).map((item) => item.trim()).filter(Boolean))];
}

export function buildSalesforceAuthorizationUrl(input: {
  clientId: string;
  redirectUri: string;
  state: string;
  scopes: readonly string[];
  loginBaseUrl?: string;
  codeChallenge?: string;
}): string {
  const base = normalizeSalesforceLoginBaseUrl(input.loginBaseUrl);
  const requestedScopes = [...new Set(input.scopes.map((scope) => scope.trim()).filter(Boolean))];
  if (!requestedScopes.length) throw new Error('At least one Salesforce OAuth scope is required');

  const url = new URL('/services/oauth2/authorize', base);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', required(input.clientId, 'Salesforce client ID'));
  url.searchParams.set('redirect_uri', required(input.redirectUri, 'Salesforce redirect URI'));
  url.searchParams.set('state', required(input.state, 'Salesforce OAuth state'));
  url.searchParams.set('scope', requestedScopes.join(' '));
  if (input.codeChallenge?.trim()) {
    url.searchParams.set('code_challenge', input.codeChallenge.trim());
    url.searchParams.set('code_challenge_method', 'S256');
  }
  return url.toString();
}

export async function exchangeSalesforceCode(input: {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  code: string;
  loginBaseUrl?: string;
  codeVerifier?: string;
  fetchImpl?: SalesforceFetch;
}): Promise<SalesforceTokenResponse> {
  const base = normalizeSalesforceLoginBaseUrl(input.loginBaseUrl);
  const response = await postForm(
    `${base}/services/oauth2/token`,
    {
      grant_type: 'authorization_code',
      client_id: required(input.clientId, 'Salesforce client ID'),
      client_secret: required(input.clientSecret, 'Salesforce client secret'),
      redirect_uri: required(input.redirectUri, 'Salesforce redirect URI'),
      code: required(input.code, 'Salesforce authorization code'),
      ...(input.codeVerifier?.trim() ? { code_verifier: input.codeVerifier.trim() } : {})
    },
    input.fetchImpl ?? fetch
  );

  let body: Record<string, unknown>;
  try {
    body = (await response.json()) as Record<string, unknown>;
  } catch {
    throw new SalesforceOAuthError({ code: 'malformed_response', status: response.status });
  }
  const accessToken = stringOrNull(body.access_token);
  const instanceUrl = stringOrNull(body.instance_url);
  const identityUrl = stringOrNull(body.id);
  if (!accessToken || !instanceUrl || !identityUrl) {
    throw new SalesforceOAuthError({ code: 'malformed_response', status: response.status });
  }

  return {
    accessToken,
    refreshToken: stringOrNull(body.refresh_token),
    tokenType: stringOrNull(body.token_type) ?? 'Bearer',
    scopes: scopes(body.scope),
    instanceUrl: normalizeSalesforceInstanceUrl(instanceUrl),
    identityUrl,
    issuedAt:
      typeof body.issued_at === 'string' && Number.isFinite(Number(body.issued_at))
        ? Number(body.issued_at)
        : null
  };
}

export async function refreshSalesforceToken(input: {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  loginBaseUrl?: string;
  fetchImpl?: SalesforceFetch;
}): Promise<Pick<SalesforceTokenResponse, 'accessToken' | 'refreshToken' | 'tokenType' | 'scopes' | 'instanceUrl' | 'identityUrl' | 'issuedAt'>> {
  const base = normalizeSalesforceLoginBaseUrl(input.loginBaseUrl);
  const response = await postForm(
    `${base}/services/oauth2/token`,
    {
      grant_type: 'refresh_token',
      client_id: required(input.clientId, 'Salesforce client ID'),
      client_secret: required(input.clientSecret, 'Salesforce client secret'),
      refresh_token: required(input.refreshToken, 'Salesforce refresh token')
    },
    input.fetchImpl ?? fetch
  );

  let body: Record<string, unknown>;
  try {
    body = (await response.json()) as Record<string, unknown>;
  } catch {
    throw new SalesforceOAuthError({ code: 'malformed_response', status: response.status });
  }
  const accessToken = stringOrNull(body.access_token);
  const instanceUrl = stringOrNull(body.instance_url);
  const identityUrl = stringOrNull(body.id);
  if (!accessToken || !instanceUrl || !identityUrl) {
    throw new SalesforceOAuthError({ code: 'malformed_response', status: response.status });
  }
  return {
    accessToken,
    refreshToken: stringOrNull(body.refresh_token),
    tokenType: stringOrNull(body.token_type) ?? 'Bearer',
    scopes: scopes(body.scope),
    instanceUrl: normalizeSalesforceInstanceUrl(instanceUrl),
    identityUrl,
    issuedAt:
      typeof body.issued_at === 'string' && Number.isFinite(Number(body.issued_at))
        ? Number(body.issued_at)
        : null
  };
}

export async function introspectSalesforceToken(input: {
  clientId: string;
  clientSecret: string;
  token: string;
  tokenTypeHint?: 'access_token' | 'refresh_token';
  loginBaseUrl?: string;
  fetchImpl?: SalesforceFetch;
}): Promise<SalesforceTokenIntrospection> {
  const base = normalizeSalesforceLoginBaseUrl(input.loginBaseUrl);
  const response = await postForm(
    `${base}/services/oauth2/introspect`,
    {
      token: required(input.token, 'Salesforce token'),
      token_type_hint: input.tokenTypeHint ?? 'access_token',
      client_id: required(input.clientId, 'Salesforce client ID'),
      client_secret: required(input.clientSecret, 'Salesforce client secret')
    },
    input.fetchImpl ?? fetch
  );
  let body: Record<string, unknown>;
  try {
    body = (await response.json()) as Record<string, unknown>;
  } catch {
    throw new SalesforceOAuthError({ code: 'malformed_response', status: response.status });
  }
  if (typeof body.active !== 'boolean') {
    throw new SalesforceOAuthError({ code: 'malformed_response', status: response.status });
  }
  return {
    active: body.active,
    clientId: stringOrNull(body.client_id),
    username: stringOrNull(body.username),
    subject: stringOrNull(body.sub),
    scopes: scopes(body.scope),
    expiresAt: typeof body.exp === 'number' && Number.isFinite(body.exp) ? body.exp * 1000 : null
  };
}

export async function revokeSalesforceToken(input: {
  token: string;
  loginBaseUrl?: string;
  fetchImpl?: SalesforceFetch;
}): Promise<void> {
  const base = normalizeSalesforceLoginBaseUrl(input.loginBaseUrl);
  await postForm(
    `${base}/services/oauth2/revoke`,
    { token: required(input.token, 'Salesforce token') },
    input.fetchImpl ?? fetch
  );
}
