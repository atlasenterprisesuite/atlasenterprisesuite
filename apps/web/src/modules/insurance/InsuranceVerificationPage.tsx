import { type ChangeEvent, type FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  InsuranceApiError,
  type InsuranceChallengeResponse,
  type InsuranceVerificationScope,
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
  delivery_not_configured: 'Verification delivery is not configured for this ATLAS environment.',
  delivery_failed: 'ATLAS could not deliver the verification code. Try again or contact your administrator.',
  verification_required: 'Verification is required before continuing.',
  insurance_verification_failed: 'ATLAS Insurance could not complete verification. Try again.'
};

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

  const [challenge, setChallenge] = useState<InsuranceChallengeResponse | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<'issue' | 'verify' | 'resend' | null>('issue');
  const [error, setError] = useState('');
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;
    setBusy('issue');
    setError('');
    setChallenge(null);
    setCode('');

    void issueInsuranceChallenge({ scope, resource_id: resourceId })
      .then((result) => {
        if (!cancelled) setChallenge(result);
      })
      .catch((cause) => {
        if (!cancelled) setError(userMessage(cause));
      })
      .finally(() => {
        if (!cancelled) setBusy(null);
      });

    return () => {
      cancelled = true;
    };
  }, [resourceId, scope]);

  useEffect(() => {
    if (!challenge) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [challenge]);

  const resendSeconds = challenge
    ? Math.max(0, Math.ceil((new Date(challenge.resend_available_at).getTime() - now) / 1000))
    : 0;
  const canSubmit = Boolean(challenge) && isSixDigitCode(code) && busy === null && !error;

  function handleCodeChange(event: ChangeEvent<HTMLInputElement>) {
    setCode(event.target.value.replace(/\D/g, '').slice(0, 6));
    if (error) setError('');
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!challenge || !canSubmit) return;

    setBusy('verify');
    setError('');
    try {
      await verifyInsuranceChallenge({ challenge_id: challenge.challenge_id, code });
      navigate(returnTo, { replace: true });
    } catch (cause) {
      setError(userMessage(cause));
    } finally {
      setBusy(null);
    }
  }

  async function handleResend() {
    if (!challenge || busy !== null || resendSeconds > 0) return;

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
          <p>Use the six-digit code delivered for this protected insurance session.</p>
        </header>

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
              disabled={busy === 'verify'}
              placeholder="— — — — — —"
            />
          </label>

          <div id="insurance-verification-status" className="insurance-verification-status" aria-live="polite">
            {busy === 'issue' ? <span>Preparing secure verification…</span> : null}
            {challenge && !error ? <span>Code sent to <strong>{challenge.delivery_target_masked}</strong></span> : null}
          </div>

          {error ? <div className="insurance-verification-error" role="alert">{error}</div> : null}

          <button className="insurance-continue" type="submit" disabled={!canSubmit}>
            {busy === 'verify' ? 'Verifying…' : 'Continue'}
          </button>

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
        </form>

        <div className="insurance-verification-meta">
          <span>{scope === 'member_policy' ? 'Member / policy verification' : 'Insurance access verification'}</span>
          <Link to="/insurance">Back to Insurance Hub</Link>
        </div>
      </div>
    </section>
  );
}
