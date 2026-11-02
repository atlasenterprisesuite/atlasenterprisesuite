import { useState } from 'react';
import {
  PROTECTIVE_WEAR_CONCEPTS, WEAR_STANDARDS, assessWearComponent,
  type WearUseCase
} from './protectiveWearModel';

const threats = {
  'abrasion-cut': 'Abrasion / cut',
  stab: 'Knife / puncture',
  ballistic: 'Ballistic'
};

export function ProtectiveWearPanel() {
  const [useCase, setUseCase] = useState<WearUseCase>('courier');
  const concept = PROTECTIVE_WEAR_CONCEPTS[useCase];

  return (
    <article className="feature-card wide" aria-labelledby="atlas-wear-heading">
      <div className="card-heading">
        <div>
          <p className="eyebrow">ATLAS Safety · Wearable research</p>
          <h2 id="atlas-wear-heading">Protective Wear — Research dossier</h2>
        </div>
        <span className="status-chip warning">Concept only · not certified</span>
      </div>
      <p>
        Explore an ergonomic garment carrier for separately verified protective components.
        This software does not verify physical protection and no tested ATLAS garment exists yet.
      </p>
      <label className="field">
        <span>Select intended use</span>
        <select value={useCase} onChange={(event) => setUseCase(event.target.value as WearUseCase)}>
          {Object.entries(PROTECTIVE_WEAR_CONCEPTS).map(([id, item]) =>
            <option key={id} value={id}>{item.label}</option>)}
        </select>
      </label>
      <h3>{concept.label}</h3>
      <p>{concept.primaryGoal}</p>
      <div className="module-grid compact" aria-label="Protection research requirements">
        {concept.targetThreats.map((threat) => {
          const result = assessWearComponent(threat, []);
          return (
            <section className="module-card" key={threat}>
              <span>Research requirement</span>
              <strong>{threats[threat]}</strong>
              <p>{WEAR_STANDARDS[threat]
                ? `Review exact protective-panel model against ${WEAR_STANDARDS[threat]} and applicable addenda.`
                : 'Evaluate abrasion and cut-specific testing separately; do not imply stab or ballistic resistance.'}</p>
              <span className="status-chip warning">{result.state === 'blocked' ? 'No verified evidence' : 'Review required'}</span>
            </section>
          );
        })}
      </div>
      <h3>Ergonomics and usability</h3>
      <ul>{concept.designPriorities.map((priority) => <li key={priority}>{priority}</li>)}</ul>
      <div className="notice strong" role="status">
        No protection level, product listing, manufacturing validation or safety approval is claimed.
        Do not trim, sew through or modify tested protective inserts. The finished garment requires
        independent fit, coverage, configuration and test review before protective marketing or use.
      </div>
    </article>
  );
}
