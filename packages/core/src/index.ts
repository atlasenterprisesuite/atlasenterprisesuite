export type TenantScope = {
  tenantId: string;
  organizationId: string;
};

export type AccountingPermission =
  | 'accounting.read'
  | 'accounting.write'
  | 'accounting.post'
  | 'accounting.close'
  | 'accounting.admin'
  | 'audit.read';

export type IntegrationPermission =
  | 'integrations.admin'
  | 'google.gmail.read'
  | 'google.gmail.write'
  | 'google.calendar.read'
  | 'google.calendar.write'
  | 'google.drive.read'
  | 'google.drive.write';

export type IntegrationProvider = 'google';

export type IntegrationConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'error';

export type IntegrationConnection = {
  scope: TenantScope;
  provider: IntegrationProvider;
  status: IntegrationConnectionStatus;
};

export type GoogleOAuthStatePayload = {
  version: 1;
  userId: string;
  organizationId: string;
  permissions: string[];
  nonce: string;
  expiresAt: number;
};

const GOOGLE_OAUTH_SCOPES: Record<IntegrationPermission, readonly string[]> = {
  'integrations.admin': [],
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

function assertGoogleOAuthStatePayload(
  payload: GoogleOAuthStatePayload,
  now?: number
): void {
  if (payload.version !== 1) throw new Error('Invalid Google OAuth state version');
  if (!payload.userId?.trim()) throw new Error('Invalid Google OAuth state user');
  if (!payload.organizationId?.trim()) throw new Error('Invalid Google OAuth state organization');
  if (!payload.nonce?.trim()) throw new Error('Invalid Google OAuth state nonce');
  if (!Number.isFinite(payload.expiresAt) || payload.expiresAt <= 0) {
    throw new Error('Invalid Google OAuth state expiration');
  }
  if (!Array.isArray(payload.permissions) || payload.permissions.length === 0) {
    throw new Error('Invalid Google OAuth state permissions');
  }

  for (const permission of payload.permissions) {
    if (
      typeof permission !== 'string' ||
      permission === 'integrations.admin' ||
      !(permission in GOOGLE_OAUTH_SCOPES) ||
      GOOGLE_OAUTH_SCOPES[permission as IntegrationPermission].length === 0
    ) {
      throw new Error('Invalid Google OAuth state permission');
    }
  }

  if (now !== undefined && payload.expiresAt <= now) {
    throw new Error('Google OAuth state expired');
  }
}

async function importGoogleOAuthStateKey(secret: string): Promise<CryptoKey> {
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

export function sameScope(a: TenantScope, b: TenantScope) {
  return a.tenantId === b.tenantId && a.organizationId === b.organizationId;
}
export * from './scope';
export * from './permissions';
export * from './audit';
export * from './integrations';
export * from './endpoints';

import type { TenantScope } from './scope';
import type { AtlasPermission } from './permissions';

export function hasIntegrationPermission(
  granted: readonly string[],
  required: IntegrationPermission
) {
  return granted.includes(required) || granted.includes('integrations.admin');
}

export function googleOAuthScopesForPermissions(
  permissions: readonly string[]
): string[] {
  const scopes = new Set<string>();

  for (const permission of permissions) {
    if (!(permission in GOOGLE_OAUTH_SCOPES)) continue;

    for (const scope of GOOGLE_OAUTH_SCOPES[permission as IntegrationPermission]) {
      scopes.add(scope);
    }
  }

  return [...scopes];
}

export function buildGoogleAuthorizationUrl(input: {
  clientId: string;
  redirectUri: string;
  state: string;
  permissions: readonly string[];
}): string {
  const clientId = input.clientId.trim();
  const redirectUri = input.redirectUri.trim();
  const state = input.state.trim();

  if (!clientId) throw new Error('Google OAuth client ID is required');
  if (!redirectUri) throw new Error('Google OAuth redirect URI is required');
  if (!state) throw new Error('Google OAuth state is required');

  const scopes = googleOAuthScopesForPermissions(input.permissions);
  if (scopes.length === 0) {
    throw new Error('Google OAuth scope set cannot be empty');
  }

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

export async function signGoogleOAuthState(input: {
  secret: string;
  payload: GoogleOAuthStatePayload;
}): Promise<string> {
  assertGoogleOAuthStatePayload(input.payload);
  const key = await importGoogleOAuthStateKey(input.secret);
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
  const parts = input.state.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error('Invalid Google OAuth state');
  }

  const [body, encodedSignature] = parts;
  const key = await importGoogleOAuthStateKey(input.secret);

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

  assertGoogleOAuthStatePayload(payload, input.now ?? Date.now());
  return payload;
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
}): Promise<{ authorizationUrl: string; state: string; expiresAt: number }> {
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
    permissions: [...input.permissions],
    nonce: input.nonce.trim(),
    expiresAt: input.now + ttlMs
  };

  const state = await signGoogleOAuthState({
    secret: input.stateSecret,
    payload
  });
  const authorizationUrl = buildGoogleAuthorizationUrl({
    clientId: input.clientId,
    redirectUri: input.redirectUri,
    state,
    permissions: payload.permissions
  });

  return {
    authorizationUrl,
    state,
    expiresAt: payload.expiresAt
  };
}

export function createIntegrationConnection(input: {
  scope: TenantScope;
  provider: IntegrationProvider;
}): IntegrationConnection {
  return {
    scope: {
      tenantId: input.scope.tenantId,
      organizationId: input.scope.organizationId
    },
    provider: input.provider,
    status: 'disconnected'
  };
}

export function integrationConnectionKey(input: {
  scope: TenantScope;
  provider: IntegrationProvider;
}) {
  return `${input.scope.tenantId}:${input.scope.organizationId}:${input.provider}`;
}

export const demoAtlasContext = {
  scope: { tenantId: 'tenant-demo', organizationId: 'org-demo' } satisfies TenantScope,
  actorId: 'demo-user',
  permissions: ['accounting.read'] as AtlasPermission[],
  environment: 'demo' as const
};
