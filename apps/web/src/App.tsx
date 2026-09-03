import { useMemo, useState } from 'react';
import { Link, Navigate, Outlet, Route, Routes, useParams } from 'react-router-dom';
import { AtlasShell } from './components/AtlasShell';
import { LabNav } from './components/LabNav';
import { NeuralGraphPanel } from './components/NeuralGraphPanel';
import { ResearchBadge } from './components/ResearchBadge';
import { curabilityDefinitions } from '../../../packages/health/curability';
import { evidenceLabel } from '../../../packages/health/evidence';
import { graphForDisease, validateGraph } from '../../../packages/health/neural-graph';
import { calculateVulnerability } from '../../../packages/health/reconstruction';
import type { CurabilityLevel, EvidenceLevel, EvidenceStatus } from '../../../packages/health/types';
import {
  demoDataNotice,
  diseases,
  evidenceRecords,
  falsificationRecords,
  graphEdges,
  graphNodes,
  vulnerabilityProfiles
} from '../../../data/research/seed';

const labBase = '/health/research/frontiers/disease-reconstruction';

function PageHeader({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <header className="page-header">
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      <p>{description}</p>
    </header>
  );
}

function EnterpriseHome() {
  return (
    <section className="page-stack">
      <PageHeader eyebrow="ATLAS Enterprise Suite" title="One governed ecosystem" description="Enterprise foundations for connected business and health modules, built with explicit security, evide[...]" />
      <div className="hero-grid">
        <article className="feature-card accent"><p className="eyebrow">Active foundation</p><h2>ATLAS Health</h2><p>Health research architecture with explicit separation between evidence, hypothe[...]</p></article>
        <article className="feature-card"><p className="eyebrow">Environment</p><h2>Development</h2><p>No live clinical integrations, patient data, or production datastore are represented in this [...]</p></article>
      </div>
    </section>
  );
}

function HealthHome() {
  return (
    <section className="page-stack">
      <PageHeader eyebrow="Health" title="ATLAS Health" description="A governed smart-health and biomedical research ecosystem. This milestone implements the research layer without pretending to b[...]" />
      <ResearchBadge />
      <div className="module-grid">
        <Link className="module-card enabled" to="/health/research"><span>Research & Innovation</span><strong>Health Frontiers</strong><p>Evidence registry, Neural Graph, falsification, reconstruc[...]</p></Link>
        <div className="module-card disabled" aria-disabled="true"><span>Clinical systems</span><strong>Not configured</strong><p>EHR, FHIR, HL7 and patient workflows are intentionally absent from[...]</p></div>
        <div className="module-card disabled" aria-disabled="true"><span>Hospital operations</span><strong>No live connection</strong><p>No fabricated census, bed, staffing, pharmacy or facility m[...]</p></div>
      </div>
    </section>
  );
}

function ResearchHome() {
  return (
    <section className="page-stack">
      <PageHeader eyebrow="ATLAS Health" title="Research & Innovation" description="Convert biomedical claims into traceable evidence, mechanisms, contradictions and testable reconstruction models[...]" />
      <ResearchBadge />
      <Link className="feature-card link-card" to="/health/research/frontiers">
        <p className="eyebrow">Research program</p><h2>Health Frontiers</h2><p>Cross-disease investigation with explicit falsification and evidence-level controls.</p><span className="action-link">[...]</span>
      </Link>
    </section>
  );
}

function FrontiersHome() {
  return (
    <section className="page-stack">
      <PageHeader eyebrow="Research & Innovation" title="Health Frontiers" description="A structured research workspace for persistent diseases, causal mechanisms, escape routes, repair and durabl[...]" />
      <ResearchBadge />
      <Link className="feature-card link-card accent" to={labBase}>
        <p className="eyebrow">Core laboratory</p><h2>Disease Reconstruction Lab</h2><p>Ask what minimum surviving biological states are sufficient to reconstruct disease, then test those connecti[...]</p>
      </Link>
    </section>
  );
}

function LabLayout() {
  return (
    <div className="lab-shell">
      <aside className="lab-sidebar">
        <div><p className="eyebrow">Health Frontiers</p><strong>Disease Reconstruction Lab</strong></div>
        <LabNav />
      </aside>
      <section className="lab-content"><Outlet /></section>
    </div>
  );
}

function LabOverview() {
  const graphStatus = validateGraph(graphNodes, graphEdges, evidenceRecords);
  return (
    <div className="page-stack">
      <PageHeader eyebrow="Health Frontiers" title="Disease Reconstruction Lab" description="Map disease persistence as seed, state, niche, adaptation, reconstruction and relapse while preserving[...]" />
      <ResearchBadge />
      <div className="notice">{demoDataNotice}</div>
      <div className="stat-grid" aria-label="Repository data status">
        <article><strong>{diseases.length}</strong><span>demo disease workspaces</span></article>
        <article><strong>{evidenceRecords.length}</strong><span>governed demo evidence records</span></article>
        <article><strong>{graphNodes.length}</strong><span>Neural Graph nodes</span></article>
        <article><strong>{graphStatus.valid ? 'PASS' : 'FAIL'}</strong><span>graph integrity</span></article>
      </div>
      <div className="module-grid compact">
        <Link className="module-card enabled" to={`${labBase}/neural-graph`}><span>Mechanisms</span><strong>Neural Graph</strong><p>Inspect nodes, edges, confidence and evidence references.</p></Link>
        <Link className="module-card enabled" to={`${labBase}/evidence`}><span>Provenance</span><strong>Evidence Registry</strong><p>Separate human, preclinical, mechanistic and hypothesis-level [...]</p></Link>
        <Link className="module-card enabled" to={`${labBase}/falsification`}><span>Challenge</span><strong>Falsification Engine</strong><p>Preserve counterexamples, escape routes, negative evide[...]</p></Link>
        <Link className="module-card enabled" to={`${labBase}/vulnerability`}><span>Research model</span><strong>Vulnerability Engine</strong><p>Transparent, research-only reconstruction scoring [...]</p></Link>
      </div>
    </div>
  );
}

function DiseasesPage() {
  return (
    <div className="page-stack">
      <PageHeader eyebrow="Disease Reconstruction Lab" title="Diseases" description="Mechanism-centered workspaces. Clinical labels do not imply a universal molecular mechanism." />
      <div className="disease-list">
        {diseases.map((disease) => (
          <Link key={disease.id} className="disease-row" to={`${labBase}/diseases/${disease.slug}`}>
            <span><small>{disease.category}</small><strong>{disease.name}</strong><p>{disease.description}</p></span>
            <span className="status-chip">{disease.activeResearchStatus}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function DiseaseDetailPage() {
  const { slug } = useParams();
  const disease = diseases.find((item) => item.slug === slug);
  if (!disease) return <Navigate to={`${labBase}/diseases`} replace />;
  const diseaseEvidence = evidenceRecords.filter((record) => record.diseaseIds.includes(disease.id));
  const graph = graphForDisease(disease.id, graphNodes, graphEdges);
  return (
    <div className="page-stack">
      <PageHeader eyebrow={disease.category} title={disease.name} description={disease.description} />
      <ResearchBadge />
      <div className="detail-grid">
        <article className="feature-card"><p className="eyebrow">Mechanisms</p><strong>{graph.nodes.length}</strong><p>governed demo graph nodes</p></article>
        <article className="feature-card"><p className="eyebrow">Evidence</p><strong>{diseaseEvidence.length}</strong><p>registered demo evidence records</p></article>
        <article className="feature-card"><p className="eyebrow">Curability display</p><strong>{disease.curabilityLevel}</strong><p>Demo classification only; not a clinical determination.</p></article>
      </div>
      <NeuralGraphPanel nodes={graph.nodes} edges={graph.edges} evidence={diseaseEvidence} />
    </div>
  );
}

function NeuralGraphPage() {
  const [diseaseId, setDiseaseId] = useState('all');
  const graph = useMemo(() => diseaseId === 'all' ? { nodes: graphNodes, edges: graphEdges } : graphForDisease(diseaseId, graphNodes, graphEdges), [diseaseId]);
  return (
    <div className="page-stack">
      <PageHeader eyebrow="Disease Reconstruction Lab" title="Neural Graph" description="Interactive mechanism graph. Confidence is visible; synthetic demo nodes are never promoted into scientifi[...]" />
      <label className="field">Disease filter<select value={diseaseId} onChange={(event) => setDiseaseId(event.target.value)}><option value="all">All diseases</option>{diseases.map((disease) => <option key={disease.id} value={disease.id}>{disease.name}</option>)}</select></label>
      <NeuralGraphPanel nodes={graph.nodes} edges={graph.edges} evidence={evidenceRecords} />
    </div>
  );
}

function EvidencePage() {
  const [level, setLevel] = useState<'all' | EvidenceLevel>('all');
  const [status, setStatus] = useState<'all' | EvidenceStatus>('all');
  const filtered = evidenceRecords.filter((record) => (level === 'all' || record.evidenceLevel === level) && (status === 'all' || record.status === status));
  return (
    <div className="page-stack">
      <PageHeader eyebrow="Disease Reconstruction Lab" title="Evidence Registry" description="Every record exposes provenance, evidence level, limitations, replication state, confidence and scien[...]" />
      <div className="filter-row">
        <label className="field">Evidence level<select value={level} onChange={(event) => setLevel(event.target.value as 'all' | EvidenceLevel)}><option value="all">All levels</option><option value="human">Human</option><option value="preclinical">Preclinical</option><option value="mechanistic">Mechanistic</option><option value="hypothesis">Hypothesis</option></select></label>
        <label className="field">Status<select value={status} onChange={(event) => setStatus(event.target.value as 'all' | EvidenceStatus)}><option value="all">All statuses</option><option value="active">Active</option><option value="retracted">Retracted</option></select></label>
      </div>
      {filtered.length === 0 ? <div className="empty-state"><strong>No evidence matches these filters</strong><span>Adjust filters or register governed evidence.</span></div> : (
        <div className="evidence-list">{filtered.map((record) => (
          <article key={record.id} className="evidence-card">
            <div className="card-heading"><span className="status-chip">{evidenceLabel(record.evidenceLevel)}</span><span className="status-chip neutral">{record.status}</span></div>
            <h3>{record.title}</h3><p>{record.finding}</p>
            <dl><div><dt>Source</dt><dd>{record.sourceName}</dd></div><div><dt>Identifier</dt><dd>{record.sourceIdentifier}</dd></div><div><dt>Replication</dt><dd>{record.replicationStatus}</dd></div></dl>
            <details><summary>Limitations & safety</summary><ul>{record.limitations.map((item) => <li key={item}>{item}</li>)}{record.safetySignals.map((item) => <li key={item}>{item}</li>)}</ul></details>
          </article>
        ))}</div>
      )}
    </div>
  );
}

function FalsificationPage() {
  return (
    <div className="page-stack">
      <PageHeader eyebrow="Disease Reconstruction Lab" title="Falsification Engine" description="A hypothesis is not protected from bad news. Counterexamples, alternative explanations, escape rou[...]" />
      {falsificationRecords.map((record) => (
        <article key={record.id} className="feature-card wide">
          <div className="card-heading"><span className="status-chip warning">{record.resultingStatus}</span><small>{record.challengeType}</small></div>
          <h3>{record.conclusion}</h3>
          <div className="falsification-grid"><div><strong>Counterexample</strong><p>{record.counterexample}</p></div><div><strong>Escape route</strong><p>{record.escapeRoute}</p></div><div><strong>Mitigation</strong><p>{record.mitigationStrategy}</p></div></div>
        </article>
      ))}
    </div>
  );
}

function VulnerabilityPage() {
  const [diseaseId, setDiseaseId] = useState(diseases[0].id);
  const profile = vulnerabilityProfiles[diseaseId];
  const result = calculateVulnerability(profile);
  return (
    <div className="page-stack">
      <PageHeader eyebrow="Disease Reconstruction Lab" title="Reconstruction Vulnerability Engine" description="Transparent rule-based research model. Scores are synthetic demonstration outputs, [...]" />
      <div className="notice">Research model only · formula {result.formulaVersion}</div>
      <label className="field">Disease workspace<select value={diseaseId} onChange={(event) => setDiseaseId(event.target.value)}>{diseases.map((disease) => <option key={disease.id} value={disease.id}>{disease.name}</option>)}</select></label>
      <div className="risk-panel"><div className="risk-score"><strong>{result.reconstructionRisk}</strong><span>/100 demo reconstruction score</span></div><div className="contribution-list">{Object.entries(result.contributionsByFactor).map(([factor, contribution]) => <div key={factor}><span>{factor}</span><span>{Math.round(contribution as number)}%</span></div>)}</div></div>
    </div>
  );
}

function CurabilityPage() {
  const levels = Object.entries(curabilityDefinitions) as [CurabilityLevel, string][];
  return (
    <div className="page-stack">
      <PageHeader eyebrow="Disease Reconstruction Lab" title="Curability Index" description="Research classification that separates symptom control, disease modification, remission, reproducible [...]" />
      <div className="notice strong">C5-C7 are code-gated. A case report, animal result, hypothesis, biomarker response, or retracted record cannot promote a disease into a cure-level claim.</div>
      <div className="curability-list">{levels.map(([level, definition]) => <article key={level}><strong>{level}</strong><span>{definition}</span></article>)}</div>
    </div>
  );
}

function UpdatesPage() {
  return (
    <div className="page-stack"><PageHeader eyebrow="Disease Reconstruction Lab" title="Research Updates" description="This view reports only data actually registered in the repository." /><div className="empty-state"><strong>No updates</strong><span>Register research activities to populate this feed.</span></div></div>
  );
}

function SettingsPage() {
  return (
    <div className="page-stack"><PageHeader eyebrow="Disease Reconstruction Lab" title="Settings" description="Environment and governance status for this implementation milestone." /><div className="empty-state"><strong>Settings unavailable</strong><span>This is a read-only demonstration environment.</span></div></div>
  );
}

function NotFound() {
  return <section className="page-stack"><PageHeader eyebrow="Navigation" title="Route not found" description="This route is not part of the supported ATLAS Health flow." /><Link className="action-link" to="/">Return home</Link></section>;
}

export function AppRoutes() {
  return (
    <AtlasShell>
      <Routes>
        <Route path="/" element={<EnterpriseHome />} />
        <Route path="/health" element={<HealthHome />} />
        <Route path="/health/research" element={<ResearchHome />} />
        <Route path="/health/research/frontiers" element={<FrontiersHome />} />
        <Route path={labBase} element={<LabLayout />}>
          <Route index element={<LabOverview />} />
          <Route path="diseases" element={<DiseasesPage />} />
          <Route path="diseases/:slug" element={<DiseaseDetailPage />} />
          <Route path="neural-graph" element={<NeuralGraphPage />} />
          <Route path="evidence" element={<EvidencePage />} />
          <Route path="falsification" element={<FalsificationPage />} />
          <Route path="vulnerability" element={<VulnerabilityPage />} />
          <Route path="curability" element={<CurabilityPage />} />
          <Route path="updates" element={<UpdatesPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AtlasShell>
  );
}
