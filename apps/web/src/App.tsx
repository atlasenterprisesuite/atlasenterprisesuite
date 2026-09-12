import { useMemo, useState } from 'react';
import { Link, Navigate, Outlet, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { AtlasShell } from './components/AtlasShell';
import { LabNav } from './components/LabNav';
import { NeuralGraphPanel } from './components/NeuralGraphPanel';
import { ResearchBadge } from './components/ResearchBadge';
import { IdentityPage } from './identity/IdentityPage';
import { RequireAtlasIdentity } from './identity/RequireAtlasIdentity';
import { ApprovalCenterPage } from './modules/execution/ApprovalCenterPage';
import { WorkflowProgressPage } from './modules/execution/WorkflowProgressPage';
import { PayablesPage } from './modules/finance/accounting/PayablesPage';
import { VoiceStudioPage } from './modules/voice/VoiceStudioPage';
import { CreatorHome, CreatorLibrary, CreatorProviders, CreatorWorkspace } from './modules/creator/CreatorStudioPage';
import { HospitalityRoutes } from './modules/hospitality/HospitalityRoutes';
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
  return <header className="page-header"><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{description}</p></header>;
}

function EnterpriseHome() {
  return (
    <section className="page-stack">
      <PageHeader eyebrow="ATLAS Enterprise Suite" title="One governed enterprise ecosystem" description="Finance and Health now share one shell, route graph, permission boundary and verification pipeline." />
      <div className="module-grid">
        <Link className="module-card enabled" to="/finance"><span>Business</span><strong>Finance</strong><p>Accounting and financial operations, beginning with working Accounts Payable.</p></Link>
        <Link className="module-card enabled" to="/health"><span>Health</span><strong>ATLAS Health</strong><p>Governed research tooling with explicit demo-data and evidence boundaries.</p></Link>
        <Link className="module-card enabled" to="/studio"><span>Creative</span><strong>ATLAS Studio</strong><p>Governed image, video, music and voice creation workspaces.</p></Link>
      </div>
      <div className="notice">Only implemented routes are presented as active. Planned ATLAS modules remain gated until their code, data contracts and tests exist.</div>
    </section>
  );
}

function FinanceHome() {
  return (
    <section className="page-stack">
      <PageHeader eyebrow="ATLAS Finance" title="Finance" description="Governed finance operations with Accounting as the first enterprise domain." />
      <div className="module-grid">
        <Link className="module-card enabled" to="/finance/accounting/accounts-payable"><span>Accounting</span><strong>Accounts Payable</strong><p>Vendor bills, aging, balances, approvals and payment application state.</p></Link>
        <div className="module-card disabled" aria-disabled="true"><span>Accounting</span><strong>Remaining accounting routes</strong><p>Not represented as active until their approved implementation milestones pass verification.</p></div>
      </div>
    </section>
  );
}

function AccountingHome() {
  return (
    <section className="page-stack">
      <PageHeader eyebrow="ATLAS Finance" title="Accounting" description="Accounts Payable is the active accounting slice in this release candidate." />
      <Link className="module-card enabled single-card" to="/finance/accounting/accounts-payable"><span>Operations</span><strong>Open Accounts Payable</strong><p>Enter the working AP module.</p></Link>
    </section>
  );
}

function HealthHome() {
  return (
    <section className="page-stack">
      <PageHeader eyebrow="ATLAS Health" title="Health" description="A governed smart-health and biomedical research ecosystem. This release candidate exposes research functions without pretending to be a live clinical system." />
      <ResearchBadge />
      <div className="module-grid">
        <Link className="module-card enabled" to="/health/research"><span>Research & Innovation</span><strong>Health Frontiers</strong><p>Evidence registry, Neural Graph, falsification and transparent reconstruction models.</p></Link>
        <div className="module-card disabled" aria-disabled="true"><span>Clinical systems</span><strong>Not configured</strong><p>No EHR, FHIR, HL7 or patient workflow is represented as connected.</p></div>
        <div className="module-card disabled" aria-disabled="true"><span>Hospital operations</span><strong>No live connection</strong><p>No fabricated census, bed, staffing, pharmacy or facility metric is shown.</p></div>
      </div>
    </section>
  );
}

function ResearchHome() {
  return (
    <section className="page-stack">
      <PageHeader eyebrow="ATLAS Health" title="Research & Innovation" description="Convert biomedical claims into traceable evidence, mechanisms, contradictions and testable reconstruction models." />
      <ResearchBadge />
      <Link className="feature-card link-card" to="/health/research/frontiers"><p className="eyebrow">Research program</p><h2>Health Frontiers</h2><p>Cross-disease investigation with explicit falsification and evidence-level controls.</p><span className="action-link">Open Health Frontiers</span></Link>
    </section>
  );
}

function FrontiersHome() {
  return (
    <section className="page-stack">
      <PageHeader eyebrow="Research & Innovation" title="Health Frontiers" description="A structured research workspace for persistent disease mechanisms, escape routes, repair and durable surveillance concepts." />
      <ResearchBadge />
      <Link className="feature-card link-card accent" to={labBase}><p className="eyebrow">Core laboratory</p><h2>Disease Reconstruction Lab</h2><p>Model what surviving biological states may be sufficient to reconstruct disease, then challenge those connections with evidence.</p><span className="action-link">Enter laboratory</span></Link>
    </section>
  );
}

function LabLayout() {
  return (
    <div className="lab-shell">
      <aside className="lab-sidebar"><div><p className="eyebrow">Health Frontiers</p><strong>Disease Reconstruction Lab</strong></div><LabNav /></aside>
      <section className="lab-content"><Outlet /></section>
    </div>
  );
}

function LabOverview() {
  const graphStatus = validateGraph(graphNodes, graphEdges, evidenceRecords);
  return (
    <div className="page-stack">
      <PageHeader eyebrow="Health Frontiers" title="Disease Reconstruction Lab" description="Map persistence as seed, state, niche, adaptation, reconstruction and relapse while preserving evidence uncertainty." />
      <ResearchBadge />
      <div className="notice">{demoDataNotice}</div>
      <div className="stat-grid" aria-label="Repository demo data status">
        <article><strong>{diseases.length}</strong><span>demo disease workspaces</span></article>
        <article><strong>{evidenceRecords.length}</strong><span>governed demo evidence records</span></article>
        <article><strong>{graphNodes.length}</strong><span>Neural Graph nodes</span></article>
        <article><strong>{graphStatus.valid ? 'PASS' : 'FAIL'}</strong><span>graph integrity</span></article>
      </div>
      <div className="module-grid compact">
        <Link className="module-card enabled" to={`${labBase}/neural-graph`}><span>Mechanisms</span><strong>Neural Graph</strong><p>Inspect nodes, relationships, confidence and evidence references.</p></Link>
        <Link className="module-card enabled" to={`${labBase}/evidence`}><span>Provenance</span><strong>Evidence Registry</strong><p>Separate human, preclinical, mechanistic and hypothesis-level records.</p></Link>
        <Link className="module-card enabled" to={`${labBase}/falsification`}><span>Challenge</span><strong>Falsification Engine</strong><p>Preserve counterexamples, escape routes and negative evidence.</p></Link>
        <Link className="module-card enabled" to={`${labBase}/vulnerability`}><span>Research model</span><strong>Vulnerability Engine</strong><p>Transparent research-only reconstruction scoring.</p></Link>
      </div>
    </div>
  );
}

function DiseasesPage() {
  return (
    <div className="page-stack">
      <PageHeader eyebrow="Disease Reconstruction Lab" title="Diseases" description="Mechanism-centered demo workspaces. Clinical labels do not imply a universal molecular mechanism." />
      <div className="disease-list">{diseases.map((disease) => <Link key={disease.id} className="disease-row" to={`${labBase}/diseases/${disease.slug}`}><span><small>{disease.category}</small><strong>{disease.name}</strong><p>{disease.description}</p></span><span className="status-chip">{disease.activeResearchStatus}</span></Link>)}</div>
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
      <div className="health-detail-grid">
        <article className="feature-card"><p className="eyebrow">Mechanisms</p><strong>{graph.nodes.length}</strong><p>governed demo graph nodes</p></article>
        <article className="feature-card"><p className="eyebrow">Evidence</p><strong>{diseaseEvidence.length}</strong><p>registered demo evidence records</p></article>
        <article className="feature-card"><p className="eyebrow">Curability display</p><strong>{disease.curabilityLevel}</strong><p>Research classification only; not a clinical determination.</p></article>
      </div>
      <NeuralGraphPanel nodes={graph.nodes} edges={graph.edges} evidence={diseaseEvidence} />
    </div>
  );
}

function NeuralGraphPage() {
  const [diseaseId, setDiseaseId] = useState('all');
  const graph = useMemo(() => diseaseId === 'all' ? { nodes: graphNodes, edges: graphEdges } : graphForDisease(diseaseId, graphNodes, graphEdges), [diseaseId]);
  const visibleEvidence = diseaseId === 'all' ? evidenceRecords : evidenceRecords.filter((record) => record.diseaseIds.includes(diseaseId));
  return (
    <div className="page-stack">
      <PageHeader eyebrow="Disease Reconstruction Lab" title="Neural Graph" description="Mechanism registry with visible confidence and provenance boundaries." />
      <label className="field"><span>Disease filter</span><select value={diseaseId} onChange={(event) => setDiseaseId(event.target.value)}><option value="all">All diseases</option>{diseases.map((disease) => <option key={disease.id} value={disease.id}>{disease.name}</option>)}</select></label>
      <NeuralGraphPanel nodes={graph.nodes} edges={graph.edges} evidence={visibleEvidence} />
    </div>
  );
}

function EvidencePage() {
  const [level, setLevel] = useState<'all' | EvidenceLevel>('all');
  const [status, setStatus] = useState<'all' | EvidenceStatus>('all');
  const filtered = evidenceRecords.filter((record) => (level === 'all' || record.evidenceLevel === level) && (status === 'all' || record.status === status));
  return (
    <div className="page-stack">
      <PageHeader eyebrow="Disease Reconstruction Lab" title="Evidence Registry" description="Every demo record exposes provenance, evidence level, limitations, replication state and status." />
      <div className="filter-row">
        <label className="field"><span>Evidence level</span><select value={level} onChange={(event) => setLevel(event.target.value as 'all' | EvidenceLevel)}><option value="all">All levels</option><option value="human">Human</option><option value="preclinical">Preclinical</option><option value="mechanistic">Mechanistic</option><option value="hypothesis">Hypothesis</option></select></label>
        <label className="field"><span>Status</span><select value={status} onChange={(event) => setStatus(event.target.value as 'all' | EvidenceStatus)}><option value="all">All statuses</option><option value="active">Active</option><option value="supported">Supported</option><option value="mixed">Mixed</option><option value="retracted">Retracted</option></select></label>
      </div>
      {filtered.length === 0 ? <div className="empty-state"><strong>No evidence matches these filters</strong><span>Adjust filters or register governed evidence.</span></div> : <div className="evidence-list">{filtered.map((record) => <article key={record.id} className="evidence-card"><div className="card-heading"><span className="status-chip neutral">{evidenceLabel(record.evidenceLevel)}</span><span className="status-chip neutral">{record.status}</span></div><h3>{record.title}</h3><p>{record.finding}</p><dl><div><dt>Source</dt><dd>{record.sourceName}</dd></div><div><dt>Identifier</dt><dd>{record.sourceIdentifier}</dd></div><div><dt>Replication</dt><dd>{record.replicationStatus}</dd></div></dl><details><summary>Limitations & safety</summary><ul>{record.limitations.map((item) => <li key={item}>{item}</li>)}{record.safetySignals.map((item) => <li key={item}>{item}</li>)}</ul></details></article>)}</div>}
    </div>
  );
}

function FalsificationPage() {
  return <div className="page-stack"><PageHeader eyebrow="Disease Reconstruction Lab" title="Falsification Engine" description="Counterexamples, alternative explanations and escape routes remain visible." />{falsificationRecords.map((record) => <article key={record.id} className="feature-card wide"><div className="card-heading"><span className="status-chip warning">{record.resultingStatus}</span><small>{record.challengeType}</small></div><h3>{record.conclusion}</h3><div className="falsification-grid"><div><strong>Counterexample</strong><p>{record.counterexample}</p></div><div><strong>Escape route</strong><p>{record.escapeRoute}</p></div><div><strong>Mitigation</strong><p>{record.mitigationStrategy}</p></div></div></article>)}</div>;
}

function VulnerabilityPage() {
  const [diseaseId, setDiseaseId] = useState(diseases[0].id);
  const result = calculateVulnerability(vulnerabilityProfiles[diseaseId]);
  return <div className="page-stack"><PageHeader eyebrow="Disease Reconstruction Lab" title="Reconstruction Vulnerability Engine" description="Transparent rule-based research model. Scores are synthetic demonstration outputs, not clinical risk scores." /><div className="notice">Research model only · formula {result.formulaVersion}</div><label className="field"><span>Disease workspace</span><select value={diseaseId} onChange={(event) => setDiseaseId(event.target.value)}>{diseases.map((disease) => <option key={disease.id} value={disease.id}>{disease.name}</option>)}</select></label><div className="risk-panel"><div className="risk-score"><strong>{result.reconstructionRisk}</strong><span>/100 demo reconstruction score</span></div><div className="contribution-list">{Object.entries(result.contributionsByFactor).map(([factor, contribution]) => <div key={factor}><span>{factor}</span><span>{Math.round(contribution)} pts</span></div>)}</div></div></div>;
}

function CurabilityPage() {
  const levels = Object.entries(curabilityDefinitions) as [CurabilityLevel, string][];
  return <div className="page-stack"><PageHeader eyebrow="Disease Reconstruction Lab" title="Curability Index" description="Research classification separating symptom control, modification, remission, reproducible cure, elimination and eradication." /><div className="notice strong">C5–C7 are evidence-gated. A hypothesis, preclinical model or isolated observation cannot promote a disease into a cure-level claim.</div><div className="curability-list">{levels.map(([level, definition]) => <article key={level}><strong>{level}</strong><span>{definition}</span></article>)}</div></div>;
}

function UpdatesPage() {
  return <div className="page-stack"><PageHeader eyebrow="Disease Reconstruction Lab" title="Research Updates" description="This view reports only data actually registered in the repository." /><div className="empty-state"><strong>No updates</strong><span>Register governed research activity to populate this feed.</span></div></div>;
}

function SettingsPage() {
  return <div className="page-stack"><PageHeader eyebrow="Disease Reconstruction Lab" title="Settings" description="Environment and governance status for this implementation milestone." /><div className="empty-state"><strong>Read-only development foundation</strong><span>No production datastore or external clinical integration is configured.</span></div></div>;
}

function NotFound() {
  return <section className="page-stack"><PageHeader eyebrow="Navigation" title="Route not found" description="This route is not part of the active ATLAS module graph." /><Link className="text-link" to="/">Return home</Link></section>;
}

export function App() {
  const location = useLocation();
  if (location.pathname.startsWith('/hospitality')) return <HospitalityRoutes />;

  return (
    <AtlasShell>
      <Routes>
        <Route path="/" element={<EnterpriseHome />} />
        <Route path="/identity" element={<IdentityPage />} />
        <Route path="/approvals" element={<RequireAtlasIdentity><ApprovalCenterPage /></RequireAtlasIdentity>} />
        <Route path="/workflows/:taskId" element={<RequireAtlasIdentity><WorkflowProgressPage /></RequireAtlasIdentity>} />
        <Route path="/studio" element={<RequireAtlasIdentity><CreatorHome /></RequireAtlasIdentity>} />
        <Route path="/studio/create" element={<RequireAtlasIdentity><CreatorWorkspace /></RequireAtlasIdentity>} />
        <Route path="/studio/library" element={<RequireAtlasIdentity><CreatorLibrary /></RequireAtlasIdentity>} />
        <Route path="/studio/providers" element={<RequireAtlasIdentity><CreatorProviders /></RequireAtlasIdentity>} />
        <Route path="/studio/voice" element={<RequireAtlasIdentity><VoiceStudioPage /></RequireAtlasIdentity>} />
        <Route path="/finance" element={<FinanceHome />} />
        <Route path="/finance/accounting" element={<AccountingHome />} />
        <Route path="/finance/accounting/accounts-payable" element={<PayablesPage />} />
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
