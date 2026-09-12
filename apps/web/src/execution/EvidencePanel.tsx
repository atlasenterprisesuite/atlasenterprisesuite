import type { GuidedEvidence } from './types';

export function EvidencePanel({ evidence }: { evidence: GuidedEvidence[] }) {
  return (
    <section className="execution-panel" aria-labelledby="execution-evidence-title">
      <h3 id="execution-evidence-title">Evidence</h3>
      {evidence.length === 0 ? (
        <p>No evidence has been persisted for this step.</p>
      ) : (
        <ul className="execution-evidence-list">
          {evidence.map((item) => (
            <li key={item.id}>
              <strong>{item.kind}</strong>
              <span>{item.verified ? 'Verified' : 'Unverified'}</span>
              {item.createdAt ? <time dateTime={item.createdAt}>{item.createdAt}</time> : null}
              <code>{item.reference}</code>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
