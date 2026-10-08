import { ATLAS_SESSION_EVENT, atlasAuthorizedJson, authorizedAtlasFetch } from './atlasSession';
import { writeSession } from './atlasSessionStorage';

/**
 * Supabase Auth MFA is self-service: only the authenticated account owner can
 * enroll/challenge/verify a factor. Do not use service-role or admin tokens here.
 * Never persist a TOTP secret, challenge, or code in localStorage or logs.
 */

export type AtlasMfaFactor = {
  id: string;
  factor_type?: string;
  type?: string;
  status?: string;
  friendly_name?: string;
};

export type AtlasTotpEnrollment = {
  id: string;
  totp: { qr_code: string; secret: string; uri?: string };
};

function factorsOf(value: unknown): AtlasMfaFactor[] {
  if (Array.isArray(value)) return value as AtlasMfaFactor[];
  if (!value || typeof value !== 'object') return [];
  const response = value as Record<string, unknown>;
  const factors = response.all ?? response.factors ?? response.totp;
  return Array.isArray(factors) ? factors as AtlasMfaFactor[] : [];
}

export async function getAtlasMfaFactors(): Promise<AtlasMfaFactor[]> {
  const response = await atlasAuthorizedJson<unknown>('/auth/v1/factors', { method: 'GET' });
  return factorsOf(response).filter((factor) =>
    Boolean(factor.id) && factor.status === 'verified' && (factor.factor_type === 'totp' || factor.type === 'totp')
  );
}

export async function verifyAtlasMfaIdentity(): Promise<void> {
  const response = await authorizedAtlasFetch('/auth/v1/user', { method: 'GET' });
  if (!response.ok) throw new Error('identity_verification_failed');
  const user = await response.json().catch(() => null) as { id?: unknown } | null;
  if (!user || typeof user.id !== 'string' || !user.id) throw new Error('identity_verification_failed');
}

export async function enrollAtlasTotp(): Promise<AtlasTotpEnrollment> {
  const data = await atlasAuthorizedJson<AtlasTotpEnrollment>('/auth/v1/factors', {
    method: 'POST',
    body: JSON.stringify({ factor_type: 'totp', friendly_name: 'ATLAS Authenticator' })
  });
  if (!data?.id || !data?.totp?.secret || !data?.totp?.qr_code) {
    throw new Error('mfa_enrollment_unavailable');
  }
  return data;
}

function aalOfJwt(token: string): string | null {
  try {
    const segment = token.split('.')[1];
    if (!segment) return null;
    const normalized = segment.replace(/-/g, '+').replace(/_/g, '/');
    const claims = JSON.parse(atob(normalized)) as { aal?: unknown };
    return typeof claims.aal === 'string' ? claims.aal : null;
  } catch {
    return null;
  }
}

export async function challengeAndVerifyAtlasTotp(factorId: string, code: string): Promise<void> {
  if (!/^[0-9]{6}$/.test(code)) throw new Error('mfa_six_digit_code_required');
  if (!/^[0-9a-f-]{36}$/i.test(factorId)) throw new Error('invalid_mfa_factor');
  const challenge = await atlasAuthorizedJson<{ id?: string }>(
    `/auth/v1/factors/${factorId}/challenge`,
    { method: 'POST', body: '{}' }
  );
  if (!challenge?.id) throw new Error('mfa_challenge_unavailable');
  const session = await atlasAuthorizedJson<{ access_token?: string; refresh_token?: string }>(
    `/auth/v1/factors/${factorId}/verify`,
    { method: 'POST', body: JSON.stringify({ challenge_id: challenge.id, code }) }
  );
  // The server must issue a real AAL2 session; client-side decoding is only an
  // additional fail-closed UX check. Privileged RPCs MUST enforce AAL2 server-side.
  if (!session?.access_token || !session?.refresh_token || aalOfJwt(session.access_token) !== 'aal2') {
    throw new Error('mfa_aal2_session_not_proven');
  }
  if (!writeSession(session)) throw new Error('mfa_session_persistence_failed');
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(ATLAS_SESSION_EVENT));
}
