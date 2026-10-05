import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ACADEMY_2026_CASES } from '../../../../../../packages/tax-academy/src';
import { getAcademyCandidateSummary, type AcademyCandidateSummary } from '../../../lib/taxAcademyApi';

export function AcademyDashboard() {
  const [summary, setSummary] = useState<AcademyCandidateSummary>({ attempts: 0, passed_practicals: 0, current_level: null });
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    getAcademyCandidateSummary()
      .then((value) => { if (active) setSummary(value); })
      .catch((error) => { if (active) setMessage(error instanceof Error ? error.message : 'Unable to load Academy progress'); });
    return () => { active = false; };
  }, []);

  const totalVariants = ACADEMY_2026_CASES.reduce((sum, item) => sum + item.practiceVariants, 0);

  return (
    <div className="academy-page">
      <section className="academy-hero">
        <div>
          <p className="eyebrow">ATLAS Tax Academy · training_current</p>
          <h1>Practice &amp; Exams</h1>
          <p>Complete source-to-return simulations, governed exams, specialty paths and reviewer-gated progression.</p>
        </div>
        <Link className="academy-primary" to="/tax/academy/practice">Continue training</Link>
      </section>

      <div className="academy-warning"><strong>Training only</strong><span>2026 Academy material is training_current. Production certification remains unavailable until final IRS forms and rule packs are verified.</span></div>
      {message ? <div className="academy-warning">{message}</div> : null}

      <section className="academy-metrics" aria-label="Academy progress">
        <article><small>Current level</small><strong>{summary.current_level || 'A0'}</strong><span>Internal ATLAS level</span></article>
        <article><small>Attempts</small><strong>{summary.attempts}</strong><span>Practice + exam history</span></article>
        <article><small>Passed practicals</small><strong>{summary.passed_practicals}</strong><span>Reviewer/evidence gates still apply</span></article>
        <article><small>Practice inventory</small><strong>{totalVariants}</strong><span>{ACADEMY_2026_CASES.length} complete return templates</span></article>
      </section>

      <section className="academy-grid">
        <Link className="academy-card" to="/tax/academy/practice"><span>01</span><h2>Practice Lab</h2><p>Full synthetic returns by filing status, level and specialty.</p></Link>
        <Link className="academy-card" to="/tax/academy/exams"><span>02</span><h2>Exams</h2><p>Module, midterm, final written and practical assessments.</p></Link>
        <Link className="academy-card" to="/tax/academy/results"><span>03</span><h2>Results</h2><p>Knowledge, practical execution, compliance and remediation.</p></Link>
        <Link className="academy-card" to="/tax/academy/certification"><span>04</span><h2>Certification</h2><p>A0–A8 progression, specialties and supervised-return requirements.</p></Link>
      </section>
    </div>
  );
}
