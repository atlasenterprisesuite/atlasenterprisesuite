import { authorizedAtlasFetch } from '../../lib/atlasSession';

const INSURANCE_DEFAULT = '/insurance';
const INSURANCE_VERIFICATION_ENDPOINT = '/functions/v1/atlas-insurance-verification';

export type InsuranceVerificationScope = 'insurance_access' | 'member_policy';

export type InsuranceChallengeResponse = {
  ok: true;
  challenge_id: string;
  scope: InsuranceVerificationScope;
  resource_id: string | null;
  delivery_channel: 'email';
  delivery_target_masked: string;
  expires_at: string;
  resend_available_at: string;
};

export type InsuranceGrantResponse = {
  ok: true;
  grant: {
    scope: InsuranceVerificationScope;
    resource_id: string | null;
    verified_at: string;
    expires_at: string;
  };
};

export class InsuranceApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly retryAfterSeconds: number | null;

  constructor(input: { code: string; message?: string; status: number; retryAfterSeconds?: number | null }) {
    super(input.message || input.code);
    this.name = 'InsuranceApiError';
    this.code = input.code;
    this.status = input.status;
    this.retryAfterSeconds = input.retryAfterSeconds ?? null;
  }
}

export function resolveInsuranceReturnTo(rawTarget: string | null) {
  if (!rawTarget) return INSURANCE_DEFAULT;

  let target = rawTarget.trim();
  try {
    target = decodeURIComponent(target);
  } catch {
    return INSURANCE_DEFAULT;
  }

  if (!target.startsWith('/') || target.startsWith('//') || target.includes('\\')) {
    return INSURANCE_DEFAULT;
  }

  const pathname = target.split(/[?#]/, 1)[0];
  if (pathname === '/insurance' || pathname.startsWith('/insurance/')) {
    return target;
  }

  return INSURANCE_DEFAULT;
}

export function isSixDigitCode(value: string) {
  return /^\d{6}$/.test(value);
}

async function parseJson(response: Response) {
  const text = await response.text();
  if (!text) return {} as Record<string, unknown>;
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { error: 'invalid_response' };
  }
}

async function callInsuranceVerification<T>(payload: Record<string, unknown>): Promise<T> {
  const response = await authorizedAtlasFetch(INSURANCE_VERIFICATION_ENDPOINT, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
  const data = await parseJson(response);

  if (!response.ok) {
    const code = String(data.code || data.error || 'insurance_verification_failed');
    const message = typeof data.message === 'string' ? data.message : code;
    const retryAfterSeconds = typeof data.retry_after_seconds === 'number' ? data.retry_after_seconds : null;
    throw new InsuranceApiError({ code, message, status: response.status, retryAfterSeconds });
  }

  return data as T;
}

export function issueInsuranceChallenge(input: {
  scope: InsuranceVerificationScope;
  resource_id?: string | null;
}) {
  return callInsuranceVerification<InsuranceChallengeResponse>({
    operation: 'issue',
    scope: input.scope,
    resource_id: input.resource_id ?? null
  });
}

export function verifyInsuranceChallenge(input: { challenge_id: string; code: string }) {
  if (!isSixDigitCode(input.code)) {
    throw new InsuranceApiError({ code: 'invalid_code_format', status: 400 });
  }
  return callInsuranceVerification<InsuranceGrantResponse>({
    operation: 'verify',
    challenge_id: input.challenge_id,
    code: input.code
  });
}

export function resendInsuranceChallenge(input: { challenge_id: string }) {
  return callInsuranceVerification<InsuranceChallengeResponse>({
    operation: 'resend',
    challenge_id: input.challenge_id
  });
}
