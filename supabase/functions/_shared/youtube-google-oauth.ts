export type YouTubeTokenResponse = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  scopes: string[];
  tokenType: string;
};

export type YouTubeAuthorizedChannel = {
  id: string;
  title: string;
};

export type YouTubeFetch = typeof fetch;

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const CHANNELS_URL = 'https://www.googleapis.com/youtube/v3/channels';
const YOUTUBE_UPLOAD_SCOPE = 'https://www.googleapis.com/auth/youtube.upload';

function required(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} is required`);
  return normalized;
}

async function safeJson(response: Response): Promise<Record<string, unknown>> {
  try {
    return (await response.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export async function exchangeYouTubeAuthorizationCode(input: {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  code: string;
  codeVerifier?: string;
  fetchImpl?: YouTubeFetch;
}): Promise<YouTubeTokenResponse> {
  const params = new URLSearchParams({
    client_id: required(input.clientId, 'Google client ID'),
    client_secret: required(input.clientSecret, 'Google client secret'),
    redirect_uri: required(input.redirectUri, 'Google redirect URI'),
    code: required(input.code, 'Google authorization code'),
    grant_type: 'authorization_code',
  });
  if (input.codeVerifier !== undefined) {
    params.set('code_verifier', required(input.codeVerifier, 'Google PKCE code verifier'));
  }

  const response = await (input.fetchImpl ?? fetch)(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
  const body = await safeJson(response);
  if (!response.ok) throw new Error('Google OAuth code exchange failed');

  const accessToken = typeof body.access_token === 'string' ? body.access_token.trim() : '';
  const refreshToken = typeof body.refresh_token === 'string' ? body.refresh_token.trim() : '';
  const tokenType = typeof body.token_type === 'string' ? body.token_type.trim() : '';
  const expiresIn = typeof body.expires_in === 'number' ? body.expires_in : Number.NaN;
  const scopes = typeof body.scope === 'string'
    ? body.scope.split(/\s+/).map((scope) => scope.trim()).filter(Boolean)
    : [];

  if (!accessToken || !refreshToken || !tokenType || !Number.isFinite(expiresIn) || expiresIn <= 0) {
    throw new Error('Google OAuth token response is incomplete');
  }
  if (!scopes.includes(YOUTUBE_UPLOAD_SCOPE)) {
    throw new Error('Google OAuth token is missing YouTube upload scope');
  }

  return { accessToken, refreshToken, expiresIn, scopes, tokenType };
}

export async function fetchAuthorizedYouTubeChannel(input: {
  accessToken: string;
  fetchImpl?: YouTubeFetch;
}): Promise<YouTubeAuthorizedChannel> {
  const accessToken = required(input.accessToken, 'YouTube access token');
  const url = new URL(CHANNELS_URL);
  url.searchParams.set('part', 'id,snippet');
  url.searchParams.set('mine', 'true');

  const response = await (input.fetchImpl ?? fetch)(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body = await safeJson(response);
  if (!response.ok) throw new Error('YouTube channel verification failed');

  const items = Array.isArray(body.items) ? body.items : [];
  if (items.length !== 1) {
    throw new Error('YouTube authorization must resolve to exactly one channel');
  }
  const item = items[0] as Record<string, unknown>;
  const id = typeof item.id === 'string' ? item.id.trim() : '';
  const snippet = item.snippet && typeof item.snippet === 'object'
    ? item.snippet as Record<string, unknown>
    : {};
  const title = typeof snippet.title === 'string' ? snippet.title.trim() : '';

  if (!id || !title) throw new Error('YouTube channel response is incomplete');
  return { id, title };
}

export function destroyYouTubeTokenResponse(token: YouTubeTokenResponse): void {
  token.accessToken = '';
  token.refreshToken = '';
  token.scopes.splice(0, token.scopes.length);
  token.tokenType = '';
  token.expiresIn = 0;
}
