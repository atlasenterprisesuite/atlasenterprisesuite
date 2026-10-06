import { ACADEMY_2026_CASES } from '../../../../../../packages/tax-academy/src';
import { RequireAcademyReviewer } from './AcademyAccess';

export function AcademyAdmin() {
  return (
    <RequireAcademyReviewer>
      <div className="academy-page">
        <section className="academy-section-head"><div><p className="eyebrow">Academy administration · tax.review</p><h1>Academy Admin</h1><p>Governed visibility into curriculum versions, rule-pack state and assessment policy.</p></div></section>
        <section className="academy-metrics">
          <article><small>Rule pack</small><strong>training_current</strong><span>Production disabled</span></article>
          <article><small>Case templates</small><strong>{ACADEMY_2026_CASES.length}</strong><span>Versioned synthetic cases</span></article>
          <article><small>Practice variants</small><strong>{ACADEMY_2026_CASES.reduce((sum, item) => sum + item.practiceVariants, 0)}</strong><span>Generated exercises</span></article>
          <article><small>Professional levels</small><strong>9</strong><span>A0 through A8</span></article>
        </section>
        <section className="academy-grid">
          <article className="academy-card"><span>Rules</span><h2>Level policy</h2><p>Thresholds and professional scope are version-controlled in the deterministic domain package.</p></article>
          <article className="academy-card"><span>Forms</span><h2>2026 verification</h2><p>Final IRS forms must be verified before moving from training_current to production_certified.</p></article>
          <article className="academy-card"><span>Security</span><h2>Answer-key isolation</h2><p>Candidate endpoints never receive instructor grading keys or hidden expected values.</p></article>
        </section>
      </div>
    </RequireAcademyReviewer>
  );
}
