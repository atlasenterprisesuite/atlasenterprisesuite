import { authorizedAtlasFetch, persistAtlasSession } from './atlasSession';

export type AtlasMfaFactor = {
  id: string;
  factor_type: 'totp';
  status: string;
  friendly_name: string | null;
};

export type AtlasTotpEnrollment = {
  id: string;
  factor_type: 'totp';
  status: string;
  friendly_name: string | null;
  qr_code: string;
  secret: string;
  uri: string;
};

async function parseAuthResponse(response: Response): Promise<any> {
  const text = await response.text();
  let data: any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { error: text || 'invalid_response' };
  }
  if (!response.ok) {
    throw new Error(data?.code || data?.msg || data?.message || data?.error_description || data?.error || `Request failed (${response.status})`);
  }
  return data;
}

function normalizeFactor(raw: any): AtlasMfaFactor | null {
  const factorType = String(raw?.factor_type || raw?.type || '');
  if (factorType !== 'totp' || !raw?.id) return null;
  return {
    id: String(raw.id),
    factor_type: 'totp',
    status: String(raw.status || ''),
    friendly_name: raw.friendly_name ? String(raw.friendly_name) : null
  };
}

export async function listAtlasTotpFactors(): Promise<AtlasMfaFactor[]> {
  const response = await authorizedAtlasFetch('/auth/v1/factors', { method: 'GET' });
  const data = await parseAuthResponse(response);
  const candidates = Array.isArray(data)
    ? data
    : Array.isArray(data?.totp)
      ? data.totp
      : Array.isArray(data?.all)
        ? data.all
        : [];
  return candidates
    .map((candidate: unknown) => normalizeFactor(candidate))
    .filter((factor: AtlasMfaFactor | null): factor is AtlasMfaFactor => factor !== null);
}

export async function unenrollAtlasMfaFactor(factorId: string) {
  const response = await authorizedAtlasFetch(`/auth/v1/factors/${encodeURIComponent(factorId)}`, {
    method: 'DELETE'
  });
  return parseAuthResponse(response);
}

export async function enrollAtlasTotp(): Promise<AtlasTotpEnrollment> {
  const response = await authorizedAtlasFetch('/auth/v1/factors', {
    method: 'POST',
    body: JSON.stringify({
      factor_type: 'totp',
      friendly_name: 'ATLAS Insurance'
    })
  });
  const data = await parseAuthResponse(response);
  const totp = data?.totp || {};
  if (!data?.id || !totp?.qr_code || !totp?.secret) throw new Error('mfa_enrollment_failed');
  return {
    id: String(data.id),
    factor_type: 'totp',
    status: String(data.status || 'unverified'),
    friendly_name: data.friendly_name ? String(data.friendly_name) : 'ATLAS Insurance',
    qr_code: String(totp.qr_code),
    secret: String(totp.secret),
    uri: String(totp.uri || '')
  };
}

export async function verifyAtlasTotp(factorId: string, code: string) {
  if (!/^\d{6}$/.test(code)) throw new Error('invalid_code_format');

  const challengeResponse = await authorizedAtlasFetch(
    `/auth/v1/factors/${encodeURIComponent(factorId)}/challenge`,
    { method: 'POST', body: '{}' }
  );
  const challenge = await parseAuthResponse(challengeResponse);
  if (!challenge?.id) throw new Error('mfa_challenge_failed');

  const verifyResponse = await authorizedAtlasFetch(
    `/auth/v1/factors/${encodeURIComponent(factorId)}/verify`,
    {
      method: 'POST',
      body: JSON.stringify({ challenge_id: challenge.id, code })
    }
  );
  const verified = await parseAuthResponse(verifyResponse);
  persistAtlasSession(verified);
  return verified;
}
