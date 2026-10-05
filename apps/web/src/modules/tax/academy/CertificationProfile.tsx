import { useEffect, useState } from 'react';
import { getAcademyCandidateSummary, type AcademyCandidateSummary } from '../../../lib/taxAcademyApi';

const levels = [
  ['A0','Academy Candidate'],['A1','Tax Intake Associate'],['A2','Tax Preparer I'],['A3','Tax Preparer II'],
  ['A4','Tax Specialist'],['A5','Senior Tax Specialist'],['A6','Tax Analyst / Reviewer'],['A7','Senior Tax Analyst'],['A8','Master Tax Practitioner']
] as const;

export function CertificationProfile() {
  const [summary, setSummary] = useState<AcademyCandidateSummary>({ attempts: 0, passed_practicals: 0, current_level: null });
  useEffect(() => { getAcademyCandidateSummary().then(setSummary).catch(() => undefined); }, []);

  const currentLevel = summary.current_level || 'A0';
  const criticalFailures: string[] = [];
  const missingRequirements = currentLevel === 'A8' ? [] : ['Pass required practicals', 'Complete supervised returns', 'Obtain reviewer signoff', 'Complete annual recertification'];

  return (
    <div className="academy-page">
      <section className="academy-section-head"><div><p className="eyebrow">Professional progression</p><h1>Certification Profile</h1><p><strong>Internal ATLAS level:</strong> {currentLevel}. This is not an IRS credential and does not replace PTIN, EA, CPA, attorney, AFSP or state requirements.</p></div></section>

      <div className="academy-warning"><strong>Training only — production certification unavailable</strong><span>2026 rule-pack status is training_current until final IRS forms and governed production verification are complete.</span></div>

      <section className="academy-cert-grid">
        <article><h2>Knowledge score</h2><p>Written/module exam thresholds increase by level.</p></article>
        <article><h2>Practical score</h2><p>{summary.passed_practicals} practicals currently recorded as passed.</p></article>
        <article><h2>Critical compliance</h2><p>{criticalFailures.length ? 'Remediation required' : 'No recorded critical failure in candidate summary.'}</p></article>
        <article><h2>Supervised returns</h2><p>Required progressively for A3–A8 production scope.</p></article>
        <article><h2>Reviewer signoff</h2><p>Required before production authority expands.</p></article>
        <article><h2>Specialties</h2><p>Family & Credits · Small Business · Marketplace · Retirement · Investments · Rental · International.</p></article>
        <article><h2>External credentials</h2><p>EA Verified · CPA Verified · Attorney Verified · AFSP Verified only after independent evidence verification.</p></article>
        <article><h2>Annual recertification</h2><p>Rule pack: training_current. Next production activation requires current-year law update, annual exam, critical compliance, CE and external requirements.</p></article>
      </section>

      <section className="academy-level-path">
        {levels.map(([id, title]) => <article className={id === currentLevel ? 'active' : ''} key={id}><span>{id}</span><strong>{title}</strong></article>)}
      </section>

      <section className="academy-card"><span>Next</span><h2>Missing requirements</h2>{missingRequirements.length ? <ul>{missingRequirements.map((item) => <li key={item}>{item}</li>)}</ul> : <p>Master internal requirements satisfied; external credential status remains separate.</p>}<p><strong>Roll-forward:</strong> recertification must be current before a new tax-year production pack can reactivate production authorization.</p></section>
    </div>
  );
}
