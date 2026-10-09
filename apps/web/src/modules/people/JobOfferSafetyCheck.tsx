import { useState, type FormEvent } from 'react';
import { screenRecruiterMessage, type RecruiterRiskResult } from './recruiterRisk';

const RESULT_LABELS: Record<RecruiterRiskResult['level'], string> = {
  'high-risk': 'High-risk signals — do not proceed before independent verification',
  review: 'Warning signals — investigate before sharing information',
  inconclusive: 'No obvious signals detected — authenticity remains unverified'
};

/** Standalone in-browser precheck. No mutation or employer identity validation is performed. */
export function JobOfferSafetyCheck() {
  const [result, setResult] = useState<RecruiterRiskResult | null>(null);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setResult(screenRecruiterMessage({
      message: String(data.get('message') || ''),
      senderEmail: String(data.get('senderEmail') || ''),
      officialEmployerWebsite: String(data.get('officialEmployerWebsite') || '')
    }));
  }

  return <section className="status-card" aria-labelledby="job-safety-heading">
    <h2 id="job-safety-heading">Recruiter message safety precheck</h2>
    <p>Review potential warning signs before responding to a job offer. This text-only check does not authenticate an employer, recruiter or job posting.</p>
    <form className="atlas-form" onSubmit={submit}>
      <label>Recruiter message
        <textarea name="message" rows={4} maxLength={4000} required placeholder="Paste the offer text (remove personal details first)" />
      </label>
      <label>Recruiter email (optional)
        <input name="senderEmail" type="email" autoComplete="off" placeholder="recruiter@example.com" />
      </label>
      <label>Official employer website (optional; find independently)
        <input name="officialEmployerWebsite" type="text" autoComplete="off" placeholder="example.com" />
      </label>
      <button type="submit">Check for warning signs</button>
    </form>
    {result ? <div role="status" aria-live="polite">
      <h3>{RESULT_LABELS[result.level]}</h3>
      {result.flags.length ? <ul>{result.flags.map(flag => <li key={flag.code}>
        <strong>{flag.title} ({flag.severity === 'high' ? 'high priority' : 'caution'})</strong>: {flag.explanation}
      </li>)}</ul> : <p>Nothing suspicious was identified by these limited rules. The offer is not verified or approved.</p>}
      <p><strong>Next steps:</strong> Search for the vacancy on the employer's official career site, contact HR through an independently sourced channel, and never pay to obtain a job or send banking/identity data before verification.</p>
    </div> : null}
    <small>This checker does not submit its form to the People API or save an employer as verified. Do not enter SSNs, bank numbers, passwords or other secrets.</small>
  </section>;
}
