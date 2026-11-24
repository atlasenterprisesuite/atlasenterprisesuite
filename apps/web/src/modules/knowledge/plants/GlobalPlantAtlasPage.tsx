import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createWorkWorkflow } from '../../../work/api';

const RESEARCH_INTENT = [
  'ATLAS Global Plant Atlas 777 research cycle.',
  'Maintain a versioned world plant knowledge graph under Knowledge Atlas.',
  'Prioritize taxonomy, provenance, licensing, occurrences, specimens, morphology, conservation, DNA, literature, medicinal evidence, toxicology and regulation.',
  'Maintain the Human–Plant Relationship Graph across plants, humans, animals, microbiome, compounds, genes, receptors, diseases, medicines, food, culture, climate and geography.',
  'Do not convert traditional use into clinical efficacy, and never infer safety from missing toxicity evidence.',
  'Use source adapters, immutable provenance, calibrated identification confidence, abstention and expert review for high-risk claims.',
  'Reuse existing ATLAS execution, identity and audit controls. Fail closed when required providers, permissions, evidence or approvals are unavailable.'
].join(' ');

const RELATIONSHIP_DOMAINS = [
  'Taxonomy & provenance',
  'Occurrences & specimens',
  'Morphology & identification',
  'DNA & barcoding',
  'Human biology & microbiome',
  'Medicinal evidence',
  'Toxicology & interactions',
  'Food & agriculture',
  'Culture & governed knowledge',
  'Climate & geography',
  'Conservation & invasiveness',
  'Regulation & licensing'
];

export function GlobalPlantAtlasPage() {
  const navigate = useNavigate();
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runResearch = async () => {
    if (running) return;
    setRunning(true);
    setError(null);
    try {
      const result = await createWorkWorkflow({
        ownerModule: 'knowledge',
        intent: RESEARCH_INTENT,
        executionMode: 'hybrid',
        autonomyLevel: 'autonomous',
        runtimePreference: 'auto',
        budgetLimit: 0,
        connectionRefs: []
      });
      navigate(`/execution/${encodeURIComponent(result.workflowId)}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'global_plant_atlas_run_failed');
      setRunning(false);
    }
  };

  return (
    <section className="page-stack" aria-labelledby="global-plant-atlas-heading">
      <header className="page-header">
        <p className="eyebrow">Knowledge Atlas · Global Plant Atlas</p>
        <h1 id="global-plant-atlas-heading">World Plant Research Graph</h1>
        <p>
          A governed scientific workspace for plant taxonomy, evidence, safety, provenance and human–plant relationships.
          It preserves uncertainty instead of turning incomplete evidence into facts.
        </p>
      </header>

      <div className="metric-grid" aria-label="Global Plant Atlas operating boundaries">
        <article><span>Owner</span><strong>Knowledge</strong><small>Single canonical ATLAS knowledge domain</small></article>
        <article><span>Execution</span><strong>Hybrid</strong><small>API/browser routes revalidated server-side</small></article>
        <article><span>External budget</span><strong>$0</strong><small>No paid-provider spend authorized by this RUN</small></article>
        <article><span>Safety</span><strong>Fail closed</strong><small>Unknown evidence never becomes “safe” or “effective”</small></article>
      </div>

      <section className="workspace-card page-stack" aria-labelledby="plant-run-heading">
        <div>
          <p className="eyebrow">777 REVIEW execution</p>
          <h2 id="plant-run-heading">Start the next research cycle</h2>
          <p className="muted">
            RUN creates a canonical ATLAS Work workflow. It does not bypass identity, tenant scope, permissions,
            approvals, provider readiness, evidence requirements or budget controls.
          </p>
        </div>
        <div className="work-actions">
          <button
            type="button"
            className="execution-action"
            onClick={() => void runResearch()}
            disabled={running}
            aria-busy={running}
          >
            {running ? 'RUNNING…' : 'RUN'}
          </button>
        </div>
        {error ? <p className="work-error" role="alert">RUN blocked: {error}</p> : null}
      </section>

      <section className="workspace-card page-stack" aria-labelledby="relationship-graph-heading">
        <div>
          <p className="eyebrow">Human–Plant Relationship Graph</p>
          <h2 id="relationship-graph-heading">Scientific relationship domains</h2>
          <p className="muted">
            Each relationship is modeled as a versioned assertion with source, license, evidence stage, confidence,
            review state and temporal validity.
          </p>
        </div>
        <div className="module-grid">
          {RELATIONSHIP_DOMAINS.map((domain) => (
            <article className="module-card enabled" key={domain}>
              <span>Versioned assertion</span>
              <strong>{domain}</strong>
              <p>Source-backed relationships remain distinguishable from hypotheses, traditions and unresolved conflicts.</p>
            </article>
          ))}
        </div>
      </section>

      <div className="notice strong">
        High-risk outputs involving ingestion, medicinal use, toxicity, interactions, pregnancy, children, animals,
        conservation-sensitive locations or regulatory claims require stricter evidence and review gates.
      </div>
    </section>
  );
}
