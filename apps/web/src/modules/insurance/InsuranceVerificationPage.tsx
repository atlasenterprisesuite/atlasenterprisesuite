import { type ChangeEvent, type FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  enrollAtlasTotp,
  listAtlasTotpFactors,
  unenrollAtlasMfaFactor,
  verifyAtlasTotp,
  type AtlasTotpEnrollment
} from '../../lib/atlasMfa';
import {
  InsuranceApiError,
  type InsuranceChallengeResponse,
  type InsuranceVerificationScope,
  grantInsuranceMfa,
  isSixDigitCode,
  issueInsuranceChallenge,
  resendInsuranceChallenge,
  resolveInsuranceReturnTo,
  verifyInsuranceChallenge
} from './insuranceApi';
import './insurance.css';

const ERROR_MESSAGES: Record<string, string> = {
  authentication_required: 'Your ATLAS session is no longer valid. Sign in again.',
  no_active_organization: 'An active ATLAS organization is required for Insurance verification.',
  invalid_scope: 'This insurance verification request is not valid.',
  invalid_resource: 'The requested member or policy reference is not valid.',
  invalid_code_format: 'Enter the six-digit verification code.',
  invalid_code: 'That verification code is incorrect. Check the code and try again.',
  challenge_expired: 'This verification code has expired. Request a new code.',
  challenge_consumed: 'This verification code has already been used. Request a new code.',
  challenge_locked: 'This verification challenge is locked after too many failed attempts.',
  resend_cooldown: 'Please wait before requesting another verification code.',
  resend_limit_reached: 'The resend limit has been reached. Start a new verification challenge.',
  delivery_not_configured: 'Email verification is not configured. Use the Authenticator app instead.',
  verification_not_configured: 'Insurance verification security is not configured for this ATLAS environment.',
  delivery_failed: 'ATLAS could not deliver the verification code. Use the Authenticator app or try again.',
  verification_required: 'Verification is required before continuing.',
  mfa_required: 'A fresh Authenticator app verification is required before continuing.',
  mfa_enrollment_failed: 'ATLAS could not initialize the Authenticator app. Try again.',
  mfa_challenge_failed: 'ATLAS could not initialize the MFA challenge. Try again.',
  insurance_verification_failed: 'ATLAS Insurance could not complete verification. Try again.'
};

type VerificationMode = 'loading' | 'totp-enroll' | 'totp-verify' | 'email';
type BusyState = 'setup' | 'verify' | 'issue' | 'resend' | null;

function errorCode(cause: unknown) {
  if (cause instanceof InsuranceApiError) return cause.code;
  if (cause instanceof Error && cause.message) return cause.message;
  return 'insurance_verification_failed';
}

function userMessage(cause: unknown) {
  const code = errorCode(cause);
  return ERROR_MESSAGES[code] || ERROR_MESSAGES.insurance_verification_failed;
}

function normalizeScope(value: string | null): InsuranceVerificationScope {
  return value === 'member_policy' ? 'member_policy' : 'insurance_access';
}

export function InsuranceVerificationPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const scope = normalizeScope(params.get('scope'));
  const resourceId = scope === 'member_policy' ? params.get('resource') : null;
  const returnTo = resolveInsuranceReturnTo(params.get('returnTo'));

  const [mode, setMode] = useState<VerificationMode>('loading');
  const [factorId, setFactorId] = useState('');
  const [enrollment, setEnrollment] = useState<AtlasTotpEnrollment | null>(null);
  const [challenge, setChallenge] = useState<InsuranceChallengeResponse | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<BusyState>('setup');
  const [error, setError] = useState('');
  const [now, setNow] = useState(() => Date.now());

  async function prepareAuthenticator() {
    setBusy('setup');
    setError('');
    setChallenge(null);
    setCode('');
    setEnrollment(null);
    try {
      const factors = await listAtlasTotpFactors();
      const verified = factors.find((factor) => factor.status === 'verified');
      if (verified) {
        setFactorId(verified.id);
        setMode('totp-verify');
        return;
      }

      for (const stale of factors.filter((factor) => factor.status !== 'verified')) {
        try {
          await unenrollAtlasMfaFactor(stale.id);
        } catch {
          // Best-effort stale enrollment cleanup. The new enrollment below remains authoritative.
        }
      }

      const nextEnrollment = await enrollAtlasTotp();
      setFactorId(nextEnrollment.id);
      setEnrollment(nextEnrollment);
      setMode('totp-enroll');
    } catch (cause) {
      setMode('totp-verify');
      setError(userMessage(cause));
    } finally {
      setBusy(null);
    }
  }

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!cancelled) await prepareAuthenticator();
    })();
    return () => {
      cancelled = true;
    };
  }, [resourceId, scope]);

  useEffect(() => {
    if (!challenge || mode !== 'email') return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [challenge, mode]);

  const resendSeconds = challenge
    ? Math.max(0, Math.ceil((new Date(challenge.resend_available_at).getTime() - now) / 1000))
    : 0;
  const totpReady = (mode === 'totp-enroll' || mode === 'totp-verify') && Boolean(factorId);
  const emailReady = mode === 'email' && Boolean(challenge);
  const canSubmit = (totpReady || emailReady) && isSixDigitCode(code) && busy === null && !error;

  function handleCodeChange(event: ChangeEvent<HTMLInputElement>) {
    setCode(event.target.value.replace(/\D/g, '').slice(0, 6));
    if (error) setError('');
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;

    setBusy('verify');
    setError('');
    try {
      if (mode === 'email') {
        if (!challenge) return;
        await verifyInsuranceChallenge({ challenge_id: challenge.challenge_id, code });
      } else {
        await verifyAtlasTotp(factorId, code);
        await grantInsuranceMfa({ scope, resource_id: resourceId });
      }
      navigate(returnTo, { replace: true });
    } catch (cause) {
      setError(userMessage(cause));
    } finally {
      setBusy(null);
    }
  }

  async function handleUseEmail() {
    if (busy !== null) return;
    setBusy('issue');
    setMode('email');
    setError('');
    setCode('');
    setChallenge(null);
    try {
      const result = await issueInsuranceChallenge({ scope, resource_id: resourceId });
      setChallenge(result);
      setNow(Date.now());
    } catch (cause) {
      setError(userMessage(cause));
    } finally {
      setBusy(null);
    }
  }

  async function handleResend() {
    if (!challenge || busy !== null || resendSeconds > 0 || mode !== 'email') return;

    setBusy('resend');
    setError('');
    setCode('');
    try {
      const result = await resendInsuranceChallenge({ challenge_id: challenge.challenge_id });
      setChallenge(result);
      setNow(Date.now());
    } catch (cause) {
      setError(userMessage(cause));
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="insurance-verification-page" aria-labelledby="insurance-verification-title">
      <div className="insurance-verification-card">
        <header className="insurance-verification-header">
          <p className="eyebrow">ATLAS Insurance · Secure verification</p>
          <h1 id="insurance-verification-title">Enter your verification code</h1>
          <p>
            {mode === 'email'
              ? 'Use the six-digit code delivered for this protected insurance session.'
              : 'Use a six-digit code from your Authenticator app. No email provider is required.'}
          </p>
        </header>

        {mode === 'totp-enroll' && enrollment ? (
          <div className="insurance-mfa-enrollment" aria-label="Authenticator app setup">
            <div>
              <strong>Set up your Authenticator app</strong>
              <p>Scan this QR code with Google Authenticator, 1Password, Authy, or another TOTP app.</p>
            </div>
            <img src={enrollment.qr_code} alt="Authenticator app QR code for ATLAS Insurance" />
            <div className="insurance-mfa-secret">
              <span>Manual setup key</span>
              <code>{enrollment.secret}</code>
            </div>
          </div>
        ) : null}

        <form className="insurance-verification-form" onSubmit={handleSubmit}>
          <label className="insurance-code-field">
            <span>Verification code</span>
            <input
              aria-describedby="insurance-verification-status"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              value={code}
              onChange={handleCodeChange}
              disabled={busy === 'verify' || busy === 'setup'}
              placeholder="— — — — — —"
            />
          </label>

          <div id="insurance-verification-status" className="insurance-verification-status" aria-live="polite">
            {busy === 'setup' ? <span>Preparing secure Authenticator app verification…</span> : null}
            {mode === 'totp-enroll' && !error && busy !== 'setup'
              ? <span>Scan the QR code, then enter the current six-digit code from your <strong>Authenticator app</strong>.</span>
              : null}
            {mode === 'totp-verify' && !error && busy !== 'setup'
              ? <span>Enter the current six-digit code from your <strong>Authenticator app</strong>.</span>
              : null}
            {mode === 'email' && challenge && !error
              ? <span>Code sent to <strong>{challenge.delivery_target_masked}</strong></span>
              : null}
          </div>

          {error ? <div className="insurance-verification-error" role="alert">{error}</div> : null}

          <button className="insurance-continue" type="submit" disabled={!canSubmit}>
            {busy === 'verify' ? 'Verifying…' : 'Continue'}
          </button>

          {mode === 'email' ? (
            <>
              <button
                className="insurance-resend"
                type="button"
                onClick={() => void handleResend()}
                disabled={!challenge || busy !== null || resendSeconds > 0}
              >
                {busy === 'resend'
                  ? 'Sending…'
                  : resendSeconds > 0
                    ? `Resend Code in ${resendSeconds}s`
                    : 'Resend Code'}
              </button>
              <button
                className="insurance-resend"
                type="button"
                onClick={() => void prepareAuthenticator()}
                disabled={busy !== null}
              >
                Use Authenticator app
              </button>
            </>
          ) : (
            <button
              className="insurance-resend"
              type="button"
              onClick={() => void handleUseEmail()}
              disabled={busy !== null}
            >
              Use email code instead
            </button>
          )}
        </form>

        <div className="insurance-verification-meta">
          <span>{scope === 'member_policy' ? 'Member / policy verification' : 'Insurance access verification'}</span>
          <Link to="/insurance">Back to Insurance Hub</Link>
        </div>
      </div>
    </section>
  );
}
