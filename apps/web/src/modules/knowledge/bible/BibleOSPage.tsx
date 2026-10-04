import { useMemo, useState } from 'react';
import {
  BIBLE_OS_CANON_PROFILES,
  BIBLE_OS_LIMITATIONS,
  BIBLE_OS_MANUSCRIPTS,
  BIBLE_OS_RELATIONSHIPS,
  BIBLE_OS_SOURCES,
  BIBLE_OS_VARIANTS,
  type BibleEvidenceState
} from './bibleOsData';

type BibleOSView = 'overview' | 'canon' | 'manuscripts' | 'variants' | 'graph';

const VIEWS: ReadonlyArray<{ id: BibleOSView; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'canon', label: 'Canon Matrix' },
  { id: 'manuscripts', label: 'Manuscripts' },
  { id: 'variants', label: 'Variant Explorer' },
  { id: 'graph', label: 'Relationship Graph' }
];

function EvidenceBadge({ state }: { state: BibleEvidenceState }) {
  return <span className="status-pill">{state.replaceAll('_', ' ')}</span>;
}

function SourceLinks({ sourceIds }: { sourceIds: readonly string[] }) {
  const sources = BIBLE_OS_SOURCES.filter(source => sourceIds.includes(source.id));
  return (
    <ul className="plain-list" aria-label="Evidence sources">
      {sources.map(source => (
        <li key={source.id}>
          <a href={source.url} target="_blank" rel="noreferrer">{source.title}</a>
          <small className="muted"> · {source.institution}</small>
        </li>
      ))}
    </ul>
  );
}

function OverviewPanel() {
  return (
    <section className="page-stack" aria-labelledby="bible-os-overview-heading">
      <div className="workspace-card">
        <p className="eyebrow">Overview</p>
        <h2 id="bible-os-overview-heading">Evidence before conclusion</h2>
        <p>
          Bible OS is an evidence-first research workspace for comparing manuscript witnesses, canon traditions,
          textual variants and source relationships in pursuit of the earliest attainable text. It does not assume
          that a hidden single manuscript survives, and this P0 is not a complete reconstructed Bible.
        </p>
      </div>

      <div className="metric-grid" aria-label="Bible OS P0 scope">
        <article><span>Sources</span><strong>{BIBLE_OS_SOURCES.length}</strong><small>Curated institutional seed sources</small></article>
        <article><span>Canon profiles</span><strong>{BIBLE_OS_CANON_PROFILES.length}</strong><small>Compared without universalizing one canon</small></article>
        <article><span>Witness seeds</span><strong>{BIBLE_OS_MANUSCRIPTS.length}</strong><small>Collection/manuscript metadata only</small></article>
        <article><span>Variant seeds</span><strong>{BIBLE_OS_VARIANTS.length}</strong><small>Explicitly marked as variation units</small></article>
      </div>

      <div className="workspace-card">
        <p className="eyebrow">Source registry</p>
        <h2>Primary research entry points</h2>
        <div className="module-grid">
          {BIBLE_OS_SOURCES.map(source => (
            <article className="module-card enabled" key={source.id}>
              <span>{source.status.replaceAll('_', ' ')}</span>
              <strong>{source.title}</strong>
              <p>{source.scope}</p>
              <a href={source.url} target="_blank" rel="noreferrer">Open institutional source</a>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function CanonMatrixPanel() {
  return (
    <section className="page-stack" aria-labelledby="bible-os-canon-heading">
      <div className="workspace-card">
        <p className="eyebrow">Canon Matrix</p>
        <h2 id="bible-os-canon-heading">Traditions remain distinct and inspectable</h2>
        <p className="muted">This seed deliberately avoids reducing different traditions to one universal book count. Detailed work-level mappings require source-by-source evidence.</p>
      </div>
      <div className="module-grid" aria-label="Canon profiles">
        {BIBLE_OS_CANON_PROFILES.map(profile => (
          <article className="module-card enabled" key={profile.id}>
            <span>{profile.family}</span>
            <strong>{profile.label}</strong>
            <p>{profile.note}</p>
            <EvidenceBadge state={profile.evidenceState} />
          </article>
        ))}
      </div>
    </section>
  );
}

function ManuscriptsPanel() {
  const sourceById = useMemo(() => new Map(BIBLE_OS_SOURCES.map(source => [source.id, source])), []);
  return (
    <section className="page-stack" aria-labelledby="bible-os-manuscripts-heading">
      <div className="workspace-card">
        <p className="eyebrow">Manuscripts</p>
        <h2 id="bible-os-manuscripts-heading">Witness metadata with provenance</h2>
        <p className="muted">Each record identifies what is directly witnessed and what still requires passage-level modeling.</p>
      </div>
      <div className="module-grid" aria-label="Manuscript and collection seeds">
        {BIBLE_OS_MANUSCRIPTS.map(manuscript => {
          const source = sourceById.get(manuscript.sourceId);
          return (
            <article className="module-card enabled" key={manuscript.id}>
              <span>{manuscript.dateLabel} · {manuscript.language}</span>
              <strong>{manuscript.name}</strong>
              <p>{manuscript.scope}</p>
              <EvidenceBadge state={manuscript.evidenceState} />
              <small className="muted">Confidence: {manuscript.confidence}</small>
              {source ? <a href={source.url} target="_blank" rel="noreferrer">Evidence source: {source.title}</a> : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function VariantExplorerPanel() {
  return (
    <section className="page-stack" aria-labelledby="bible-os-variants-heading">
      <div className="workspace-card">
        <p className="eyebrow">Variant Explorer</p>
        <h2 id="bible-os-variants-heading">Competing readings stay visible</h2>
        <p className="muted">A reconstructed reading is never displayed as an extant autograph. P0 records significant variation units and their provenance boundary.</p>
      </div>
      <div className="module-grid" aria-label="Textual variation seeds">
        {BIBLE_OS_VARIANTS.map(variant => (
          <article className="module-card enabled" key={variant.id}>
            <span>{variant.passage}</span>
            <strong>{variant.issue}</strong>
            <p>{variant.assessment}</p>
            <EvidenceBadge state={variant.evidenceState} />
            <small className="muted">Confidence in variation-unit identification: {variant.confidence}</small>
            <SourceLinks sourceIds={variant.sourceIds} />
          </article>
        ))}
      </div>
    </section>
  );
}

function RelationshipGraphPanel() {
  return (
    <section className="page-stack" aria-labelledby="bible-os-graph-heading">
      <div className="workspace-card">
        <p className="eyebrow">Relationship Graph</p>
        <h2 id="bible-os-graph-heading">Connections with typed meaning and evidence</h2>
        <p className="muted">The visual direction comes from large cross-reference arc maps, but every ATLAS edge must remain readable as text and expose its relation type, sources and confidence.</p>
      </div>
      <div className="module-grid" aria-label="Bible OS relationship graph as accessible cards">
        {BIBLE_OS_RELATIONSHIPS.map(edge => (
          <article className="module-card enabled" key={edge.id}>
            <span>{edge.relation}</span>
            <strong>{edge.from} → {edge.to}</strong>
            <EvidenceBadge state={edge.evidenceState} />
            <small className="muted">Confidence: {edge.confidence}</small>
            <SourceLinks sourceIds={edge.sourceIds} />
          </article>
        ))}
      </div>
    </section>
  );
}

export function BibleOSPage() {
  const [view, setView] = useState<BibleOSView>('overview');

  return (
    <section className="page-stack" aria-labelledby="bible-os-heading">
      <header className="page-header">
        <p className="eyebrow">Knowledge Atlas · Bible OS</p>
        <h1 id="bible-os-heading">ATLAS Bible OS</h1>
        <p>Critical-text research with manuscript provenance, canon comparison, textual variants and evidence-linked relationships.</p>
      </header>

      <nav className="workspace-card toolbar" aria-label="Bible OS views">
        {VIEWS.map(item => (
          <button
            key={item.id}
            className="execution-action"
            type="button"
            aria-pressed={view === item.id}
            onClick={() => setView(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {view === 'overview' ? <OverviewPanel /> : null}
      {view === 'canon' ? <CanonMatrixPanel /> : null}
      {view === 'manuscripts' ? <ManuscriptsPanel /> : null}
      {view === 'variants' ? <VariantExplorerPanel /> : null}
      {view === 'graph' ? <RelationshipGraphPanel /> : null}

      <aside className="workspace-card" aria-labelledby="bible-os-limitations-heading">
        <p className="eyebrow">Evidence & limitations</p>
        <h2 id="bible-os-limitations-heading">What this P0 does not claim</h2>
        <ul>
          {BIBLE_OS_LIMITATIONS.map(limit => <li key={limit}>{limit}</li>)}
        </ul>
      </aside>
    </section>
  );
}
