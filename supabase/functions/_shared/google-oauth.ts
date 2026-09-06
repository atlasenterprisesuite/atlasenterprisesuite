export type GoogleIntegrationPermission =
  | 'google.gmail.read'
  | 'google.gmail.write'
  | 'google.calendar.read'
  | 'google.calendar.write'
  | 'google.drive.read'
  | 'google.drive.write';

export type GoogleOAuthStatePayload = {
  version: 1;
  userId: string;
  organizationId: string;
  permissions: GoogleIntegrationPermission[];
  nonce: string;
  expiresAt: number;
};

const GOOGLE_OAUTH_SCOPES: Record<GoogleIntegrationPermission, readonly string[]> = {
  'google.gmail.read': ['https://www.googleapis.com/auth/gmail.readonly'],
  'google.gmail.write': ['https://www.googleapis.com/auth/gmail.compose'],
  'google.calendar.read': [
    'https://www.googleapis.com/auth/calendar.calendarlist.readonly',
    'https://www.googleapis.com/auth/calendar.events.freebusy',
    'https://www.googleapis.com/auth/calendar.events.readonly'
  ],
  'google.calendar.write': ['https://www.googleapis.com/auth/calendar.events'],
  'google.drive.read': ['https://www.googleapis.com/auth/drive.readonly'],
  'google.drive.write': ['https://www.googleapis.com/auth/drive.file']
};

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function encodeBase64UrlText(value: string): string {
  return bytesToBase64Url(textEncoder.encode(value));
}

function decodeBase64UrlText(value: string): string {
  return textDecoder.decode(base64UrlToBytes(value));
}

function isGooglePermission(value: string): value is GoogleIntegrationPermission {
  return Object.prototype.hasOwnProperty.call(GOOGLE_OAUTH_SCOPES, value);
}

export function normalizeGooglePermissions(values: readonly string[]): GoogleIntegrationPermission[] {
  if (!Array.isArray(values) || values.length === 0) {
    throw new Error('At least one Google integration permission is required');
  }

  const unique = new Set<GoogleIntegrationPermission>();
  for (const value of values) {
    if (typeof value !== 'string' || !isGooglePermission(value)) {
      throw new Error(`Unsupported Google integration permission: ${String(value)}`);
    }
    unique.add(value);
  }

  return [...unique];
}

export function googleOAuthScopesForPermissions(
  permissions: readonly GoogleIntegrationPermission[]
): string[] {
  const scopes = new Set<string>();
  for (const permission of permissions) {
    for (const scope of GOOGLE_OAUTH_SCOPES[permission]) scopes.add(scope);
  }
  return [...scopes];
}

async function importStateKey(secret: string): Promise<CryptoKey> {
  if (secret.trim().length < 32) {
    throw new Error('Google OAuth state secret must be at least 32 characters');
  }

  return crypto.subtle.importKey(
    'raw',
    textEncoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

function assertStatePayload(payload: GoogleOAuthStatePayload, now?: number): void {
  if (payload.version !== 1) throw new Error('Invalid Google OAuth state version');
  if (!payload.userId?.trim()) throw new Error('Invalid Google OAuth state user');
  if (!payload.organizationId?.trim()) throw new Error('Invalid Google OAuth state organization');
  if (!payload.nonce?.trim()) throw new Error('Invalid Google OAuth state nonce');
  normalizeGooglePermissions(payload.permissions);
  if (!Number.isFinite(payload.expiresAt) || payload.expiresAt <= 0) {
    throw new Error('Invalid Google OAuth state expiration');
  }
  if (now !== undefined && payload.expiresAt <= now) {
    throw new Error('Google OAuth state expired');
  }
}

export async function signGoogleOAuthState(input: {
  secret: string;
  payload: GoogleOAuthStatePayload;
}): Promise<string> {
  assertStatePayload(input.payload);
  const key = await importStateKey(input.secret);
  const body = encodeBase64UrlText(JSON.stringify(input.payload));
  const signature = new Uint8Array(
    await crypto.subtle.sign('HMAC', key, textEncoder.encode(body))
  );
  return `${body}.${bytesToBase64Url(signature)}`;
}

export async function verifyGoogleOAuthState(input: {
  secret: string;
  state: string;
  now?: number;
}): Promise<GoogleOAuthStatePayload> {
  const [body, encodedSignature, extra] = input.state.split('.');
  if (!body || !encodedSignature || extra !== undefined) {
    throw new Error('Invalid Google OAuth state');
  }

  const key = await importStateKey(input.secret);
  let signature: Uint8Array<ArrayBuffer>;
  try {
    signature = base64UrlToBytes(encodedSignature);
  } catch {
    throw new Error('Invalid Google OAuth state signature');
  }

  const valid = await crypto.subtle.verify(
    'HMAC',
    key,
    signature,
    textEncoder.encode(body)
  );
  if (!valid) throw new Error('Invalid Google OAuth state signature');

  let payload: GoogleOAuthStatePayload;
  try {
    payload = JSON.parse(decodeBase64UrlText(body)) as GoogleOAuthStatePayload;
  } catch {
    throw new Error('Invalid Google OAuth state payload');
  }

  assertStatePayload(payload, input.now ?? Date.now());
  return payload;
}

export function buildGoogleAuthorizationUrl(input: {
  clientId: string;
  redirectUri: string;
  state: string;
  permissions: readonly GoogleIntegrationPermission[];
}): string {
  const clientId = input.clientId.trim();
  const redirectUri = input.redirectUri.trim();
  const state = input.state.trim();
  if (!clientId) throw new Error('Google OAuth client ID is required');
  if (!redirectUri) throw new Error('Google OAuth redirect URI is required');
  if (!state) throw new Error('Google OAuth state is required');

  const scopes = googleOAuthScopesForPermissions(input.permissions);
  if (scopes.length === 0) throw new Error('Google OAuth scope set cannot be empty');

  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', scopes.join(' '));
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('include_granted_scopes', 'true');
  url.searchParams.set('state', state);
  return url.toString();
}

export async function prepareGoogleOAuthAuthorization(input: {
  clientId: string;
  redirectUri: string;
  stateSecret: string;
  userId: string;
  organizationId: string;
  permissions: readonly string[];
  nonce: string;
  now: number;
  ttlMs?: number;
}): Promise<{
  authorizationUrl: string;
  state: string;
  expiresAt: number;
  permissions: GoogleIntegrationPermission[];
}> {
  const permissions = normalizeGooglePermissions(input.permissions);
  const ttlMs = input.ttlMs ?? 10 * 60 * 1000;
  if (!Number.isFinite(input.now) || input.now <= 0) {
    throw new Error('Google OAuth authorization time is invalid');
  }
  if (!Number.isFinite(ttlMs) || ttlMs <= 0) {
    throw new Error('Google OAuth state TTL must be positive');
  }

  const payload: GoogleOAuthStatePayload = {
    version: 1,
    userId: input.userId.trim(),
    organizationId: input.organizationId.trim(),
    permissions,
    nonce: input.nonce.trim(),
    expiresAt: input.now + ttlMs
  };

  const state = await signGoogleOAuthState({ secret: input.stateSecret, payload });
  return {
    state,
    expiresAt: payload.expiresAt,
    permissions,
    authorizationUrl: buildGoogleAuthorizationUrl({
      clientId: input.clientId,
      redirectUri: input.redirectUri,
      state,
      permissions
    })
  };
}

export async function sha256Base64Url(value: string): Promise<string> {
  const digest = new Uint8Array(
    await crypto.subtle.digest('SHA-256', textEncoder.encode(value))
  );
  return bytesToBase64Url(digest);
}

export function randomOAuthNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return bytesToBase64Url(bytes);
}
