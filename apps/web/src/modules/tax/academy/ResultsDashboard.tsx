import { useEffect, useState } from 'react';
import { getAcademyCandidateSummary, type AcademyCandidateSummary } from '../../../lib/taxAcademyApi';

export function ResultsDashboard() {
  const [summary, setSummary] = useState<AcademyCandidateSummary>({ attempts: 0, passed_practicals: 0, current_level: null });
  useEffect(() => { getAcademyCandidateSummary().then(setSummary).catch(() => undefined); }, []);

  return (
    <div className="academy-page">
      <section className="academy-section-head"><div><p className="eyebrow">Evaluation</p><h1>Results</h1><p>ATLAS separates knowledge from practical execution and compliance evidence.</p></div></section>
      <section className="academy-metrics">
        <article><small>Knowledge score</small><strong>—</strong><span>Written/module examinations</span></article>
        <article><small>Practical score</small><strong>{summary.passed_practicals}</strong><span>Passed governed practicals</span></article>
        <article><small>Attempts</small><strong>{summary.attempts}</strong><span>Recorded candidate attempts</span></article>
        <article><small>Current level</small><strong>{summary.current_level || 'A0'}</strong><span>Internal authorization state</span></article>
      </section>
      <section className="academy-grid">
        <article className="academy-card"><span>01</span><h2>Critical compliance</h2><p>Integrity, security, due diligence and stale-year-rule failures override numerical averages.</p></article>
        <article className="academy-card"><span>02</span><h2>Remediation</h2><p>Weak domains are assigned targeted practice before a governed retake is eligible.</p></article>
        <article className="academy-card"><span>03</span><h2>Reviewer evidence</h2><p>Production progression requires supervised returns and reviewer signoff, not score alone.</p></article>
      </section>
    </div>
  );
}
