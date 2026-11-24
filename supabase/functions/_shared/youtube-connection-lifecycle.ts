import {
  prepareGoogleOAuthAuthorization,
  randomOAuthNonce,
  sha256Base64Url,
  verifyGoogleOAuthState,
} from './google-oauth.ts';
import {
  destroyCredentialPayload,
  destroySecretValues,
  openSecretValues,
  sealCredential,
  sealSecretValues,
  type CredentialKey,
  type ProviderCredentialPayload,
} from './integration-credential-vault.ts';
import {
  destroyYouTubeTokenResponse,
  exchangeYouTubeAuthorizationCode,
  fetchAuthorizedYouTubeChannel,
  type YouTubeAuthorizedChannel,
  type YouTubeTokenResponse,
} from './youtube-google-oauth.ts';
import type {
  YouTubeConnectionRow,
  YouTubeConnectionStore,
} from './youtube-connection-store.ts';

const YOUTUBE_PERMISSION = 'google.youtube.upload';
const PKCE_PURPOSE = 'oauth.pkce';

export type YouTubeLifecycleErrorCode =
  | 'oauth_state_invalid'
  | 'oauth_state_expired'
  | 'oauth_state_consumed'
  | 'oauth_state_mismatch'
  | 'oauth_state_consumption_failed'
  | 'oauth_pkce_invalid'
  | 'oauth_exchange_failed'
  | 'oauth_channel_mismatch'
  | 'credential_storage_failed';

export class YouTubeLifecycleError extends Error {
  readonly code: YouTubeLifecycleErrorCode;
  readonly status: number;

  constructor(code: YouTubeLifecycleErrorCode, status: number) {
    super(`YouTube connection lifecycle failed (${code})`);
    this.name = 'YouTubeLifecycleError';
    this.code = code;
    this.status = status;
  }
}

export type YouTubeLifecycleDependencies = {
  store: YouTubeConnectionStore;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  stateSecret: string;
  credentialKey: CredentialKey;
  keyVersion?: string;
  now?: () => number;
  exchangeCode?: typeof exchangeYouTubeAuthorizationCode;
  fetchChannel?: typeof fetchAuthorizedYouTubeChannel;
};

function required(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} is required`);
  return normalized;
}

function nowMs(deps: YouTubeLifecycleDependencies): number {
  return deps.now?.() ?? Date.now();
}

function nowIso(deps: YouTubeLifecycleDependencies): string {
  return new Date(nowMs(deps)).toISOString();
}

function flowChannelId(value: unknown): string {
  if (!value || typeof value !== 'object') {
    throw new YouTubeLifecycleError('oauth_state_mismatch', 400);
  }
  const context = value as Record<string, unknown>;
  if (context.kind !== 'youtube' || typeof context.channelId !== 'string' || !context.channelId.trim()) {
    throw new YouTubeLifecycleError('oauth_state_mismatch', 400);
  }
  return context.channelId.trim();
}

async function safeEvidence(
  deps: YouTubeLifecycleDependencies,
  input: Parameters<YouTubeConnectionStore['recordEvidence']>[0],
): Promise<void> {
  try {
    await deps.store.recordEvidence(input);
  } catch {
    // Evidence failures never expose credentials or replace lifecycle truth.
  }
}

export async function prepareYouTubeConnection(input: {
  organizationId: string;
  userId: string;
  channelId: string;
  deps: YouTubeLifecycleDependencies;
}): Promise<{ authorizationUrl: string; expiresAt: string }> {
  const organizationId = required(input.organizationId, 'Organization ID');
  const userId = required(input.userId, 'User ID');
  const channelId = required(input.channelId, 'YouTube channel ID');
  const nonce = randomOAuthNonce();
  const codeVerifier = randomOAuthNonce();
  const codeChallenge = await sha256Base64Url(codeVerifier);
  const now = nowMs(input.deps);

  const prepared = await prepareGoogleOAuthAuthorization({
    clientId: required(input.deps.clientId, 'Google client ID'),
    redirectUri: required(input.deps.redirectUri, 'Google redirect URI'),
    stateSecret: required(input.deps.stateSecret, 'Google OAuth state secret'),
    userId,
    organizationId,
    permissions: [YOUTUBE_PERMISSION],
    nonce,
    now,
    codeChallenge,
  });

  const values = { codeVerifier };
  try {
    const sealedPkce = await sealSecretValues({
      organizationId,
      provider: 'google',
      purpose: PKCE_PURPOSE,
      values,
      key: input.deps.credentialKey,
      keyVersion: input.deps.keyVersion ?? 'v1',
    });
    await input.deps.store.createOAuthState({
      organizationId,
      userId,
      nonceHash: await sha256Base64Url(nonce),
      requestedPermissions: [YOUTUBE_PERMISSION],
      expiresAt: new Date(prepared.expiresAt).toISOString(),
      flowContext: { kind: 'youtube', channelId },
      pkceCiphertext: sealedPkce.ciphertext,
      pkceIv: sealedPkce.iv,
      pkceKeyVersion: sealedPkce.keyVersion,
    });
  } finally {
    destroySecretValues(values);
  }

  await safeEvidence(input.deps, {
    org_id: organizationId,
    operation: 'youtube.oauth.prepare',
    status: 'completed',
    started_by: userId,
    completed_at: nowIso(input.deps),
  });

  return {
    authorizationUrl: prepared.authorizationUrl,
    expiresAt: new Date(prepared.expiresAt).toISOString(),
  };
}

export async function completeYouTubeConnection(input: {
  state: string;
  code: string;
  deps: YouTubeLifecycleDependencies;
}): Promise<YouTubeConnectionRow> {
  const state = required(input.state, 'Google OAuth state');
  const code = required(input.code, 'Google authorization code');
  const now = nowMs(input.deps);

  let payload;
  try {
    payload = await verifyGoogleOAuthState({
      secret: required(input.deps.stateSecret, 'Google OAuth state secret'),
      state,
      now,
    });
  } catch (error) {
    const expired = error instanceof Error && /expired/i.test(error.message);
    throw new YouTubeLifecycleError(expired ? 'oauth_state_expired' : 'oauth_state_invalid', 400);
  }

  if (payload.permissions.length !== 1 || payload.permissions[0] !== YOUTUBE_PERMISSION) {
    throw new YouTubeLifecycleError('oauth_state_mismatch', 403);
  }

  const stateRow = await input.deps.store.findOAuthState(
    await sha256Base64Url(payload.nonce),
  );
  if (!stateRow) throw new YouTubeLifecycleError('oauth_state_invalid', 400);
  if (stateRow.consumed_at) throw new YouTubeLifecycleError('oauth_state_consumed', 400);

  const expiresAt = Date.parse(stateRow.expires_at);
  if (!Number.isFinite(expiresAt) || expiresAt <= now) {
    throw new YouTubeLifecycleError('oauth_state_expired', 400);
  }
  if (
    stateRow.org_id !== payload.organizationId ||
    stateRow.user_id !== payload.userId ||
    stateRow.requested_permissions.length !== 1 ||
    stateRow.requested_permissions[0] !== YOUTUBE_PERMISSION
  ) {
    throw new YouTubeLifecycleError('oauth_state_mismatch', 403);
  }

  const channelId = flowChannelId(stateRow.flow_context);
  if (!stateRow.pkce_ciphertext || !stateRow.pkce_iv || !stateRow.pkce_key_version) {
    throw new YouTubeLifecycleError('oauth_pkce_invalid', 400);
  }

  let pkceValues: Record<string, string> | null = null;
  let token: YouTubeTokenResponse | null = null;
  let providerCredential: ProviderCredentialPayload | null = null;
  let credentialId: string | null = null;

  try {
    try {
      pkceValues = await openSecretValues({
        organizationId: stateRow.org_id,
        provider: 'google',
        purpose: PKCE_PURPOSE,
        sealed: {
          ciphertext: stateRow.pkce_ciphertext,
          iv: stateRow.pkce_iv,
          algorithm: 'AES-GCM-256',
          keyVersion: stateRow.pkce_key_version,
        },
        key: input.deps.credentialKey,
      });
    } catch {
      throw new YouTubeLifecycleError('oauth_pkce_invalid', 400);
    }

    const codeVerifier = pkceValues.codeVerifier?.trim() ?? '';
    if (!codeVerifier) throw new YouTubeLifecycleError('oauth_pkce_invalid', 400);

    const claimed = await input.deps.store.consumeOAuthState(stateRow.id, nowIso(input.deps));
    if (!claimed) {
      throw new YouTubeLifecycleError('oauth_state_consumption_failed', 409);
    }

    try {
      token = await (input.deps.exchangeCode ?? exchangeYouTubeAuthorizationCode)({
        clientId: required(input.deps.clientId, 'Google client ID'),
        clientSecret: required(input.deps.clientSecret, 'Google client secret'),
        redirectUri: required(input.deps.redirectUri, 'Google redirect URI'),
        code,
        codeVerifier,
      });
    } catch {
      throw new YouTubeLifecycleError('oauth_exchange_failed', 502);
    }

    let channel: YouTubeAuthorizedChannel;
    try {
      channel = await (input.deps.fetchChannel ?? fetchAuthorizedYouTubeChannel)({
        accessToken: token.accessToken,
      });
    } catch {
      throw new YouTubeLifecycleError('oauth_channel_mismatch', 502);
    }
    if (channel.id !== channelId) {
      throw new YouTubeLifecycleError('oauth_channel_mismatch', 403);
    }

    const credentialExpiresAt = now + token.expiresIn * 1000;
    providerCredential = {
      accessToken: token.accessToken,
      refreshToken: token.refreshToken,
      tokenType: token.tokenType,
      scopes: [...token.scopes],
      expiresAt: credentialExpiresAt,
    };
    const sealed = await sealCredential({
      organizationId: stateRow.org_id,
      provider: 'google',
      credential: providerCredential,
      key: input.deps.credentialKey,
      keyVersion: input.deps.keyVersion ?? 'v1',
    });

    const credential = await input.deps.store.insertCredential({
      org_id: stateRow.org_id,
      provider: 'google',
      ciphertext: sealed.ciphertext,
      iv: sealed.iv,
      algorithm: sealed.algorithm,
      key_version: sealed.keyVersion,
      expires_at: new Date(credentialExpiresAt).toISOString(),
    });
    credentialId = credential.id;

    const timestamp = nowIso(input.deps);
    const connection = await input.deps.store.upsertConnection({
      organizationId: stateRow.org_id,
      userId: stateRow.user_id,
      channelId: channel.id,
      channelTitle: channel.title,
      grantedScopes: token.scopes,
      credentialRef: credential.id,
      timestamp,
    });

    await safeEvidence(input.deps, {
      org_id: stateRow.org_id,
      operation: 'youtube.oauth.callback',
      status: 'completed',
      started_by: stateRow.user_id,
      completed_at: timestamp,
    });
    return connection;
  } catch (error) {
    if (credentialId) {
      try {
        await input.deps.store.deleteCredential(credentialId, stateRow.org_id);
      } catch {
        // Keep the original lifecycle failure; orphan repair is an operator task.
      }
    }
    await safeEvidence(input.deps, {
      org_id: stateRow.org_id,
      operation: 'youtube.oauth.callback',
      status: 'failed',
      started_by: stateRow.user_id,
      completed_at: nowIso(input.deps),
      error_code: error instanceof YouTubeLifecycleError ? error.code : 'credential_storage_failed',
    });
    if (error instanceof YouTubeLifecycleError) throw error;
    throw new YouTubeLifecycleError('credential_storage_failed', 500);
  } finally {
    if (pkceValues) destroySecretValues(pkceValues);
    if (providerCredential) destroyCredentialPayload(providerCredential);
    if (token) destroyYouTubeTokenResponse(token);
  }
}
