import { AVIATION_CONCEPTS } from './aviation-concepts';
import { deriveCertificationStage } from './aviation-certification';

export function AviationCertificationPage() {
  return (
    <section className="page-stack aviation-page">
      <header className="page-header">
        <p className="eyebrow">ATLAS Mobility · Aviation Intelligence</p>
        <h1>Certification Intelligence</h1>
        <p>Track authority-backed certification evidence without promoting manufacturer marketing or concept status into regulatory approval.</p>
      </header>

      <div className="notice strong" role="note">
        No regulator evidence is configured for the current internal ATLAS concepts. Every normalized stage therefore remains Unknown.
      </div>

      <div className="aviation-certification-grid">
        {AVIATION_CONCEPTS.map((aircraft) => {
          const stage = deriveCertificationStage([]);
          return (
            <article
              className="aviation-certification-card"
              data-testid="aviation-certification-card"
              key={aircraft.id}
            >
              <p className="eyebrow">{aircraft.categoryLabel}</p>
              <h2>{aircraft.modelName}</h2>
              <dl>
                <div><dt>Normalized stage</dt><dd>{stage === 'unknown' ? 'Unknown' : stage}</dd></div>
                <div><dt>Authority</dt><dd>Not configured</dd></div>
                <div><dt>Evidence</dt><dd>Evidence not configured</dd></div>
              </dl>
            </article>
          );
        })}
      </div>
    </section>
  );
}
