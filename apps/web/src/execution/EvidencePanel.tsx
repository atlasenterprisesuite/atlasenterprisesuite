import type { GuidedEvidence } from './types';

const SAFE_METADATA_KEYS = [
  'repository',
  'requested_ref',
  'resolved_sha',
  'command_identifier',
  'exit_code',
  'failure_class',
  'runner_kind',
  'started_at',
  'completed_at',
  'output_digest',
  'github_run_id'
] as const;

function metadataEntries(metadata: Record<string, unknown>) {
  return SAFE_METADATA_KEYS
    .filter((key) => metadata[key] !== undefined && metadata[key] !== null && metadata[key] !== '')
    .map((key) => [key, String(metadata[key])] as const);
}

export function EvidencePanel({ evidence }: { evidence: GuidedEvidence[] }) {
  return (
    <section className="execution-panel" aria-labelledby="execution-evidence-title">
      <h3 id="execution-evidence-title">Evidence</h3>
      {evidence.length === 0 ? (
        <p>No evidence has been persisted for this step.</p>
      ) : (
        <ul className="execution-evidence-list">
          {evidence.map((item) => {
            const entries = metadataEntries(item.metadata ?? {});
            return (
              <li key={item.id}>
                <strong>{item.kind}</strong>
                <span>{item.verified ? 'Verified' : 'Unverified'}</span>
                {item.createdAt ? <time dateTime={item.createdAt}>{item.createdAt}</time> : null}
                <code>{item.reference}</code>
                {entries.length > 0 ? (
                  <dl>
                    {entries.map(([key, value]) => (
                      <div key={key}>
                        <dt>{key.replaceAll('_', ' ')}</dt>
                        <dd><code>{value}</code></dd>
                      </div>
                    ))}
                  </dl>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
