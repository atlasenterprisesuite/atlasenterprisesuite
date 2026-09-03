import type { Disease, EvidenceRecord, FalsificationRecord, GraphEdge, GraphNode, VulnerabilityInput } from '../../packages/health/types';

const now = '2026-09-03T00:00:00Z';

export const diseases: Disease[] = [
  ['hiv', 'hiv', 'HIV', 'Persistent infection', 'Reservoir competence, rebound, immune selection, therapeutic access and durable surveillance.'],
  ['blood-cancers', 'cancers-leukemias', 'Cancers & Leukemias', 'Oncology', 'Clonal heterogeneity, residual disease, target loss, microenvironment, resistance and relapse.'],
  ['autoimmune-t1d', 'type-1-diabetes-autoimmunity', 'Type 1 Diabetes & Autoimmunity', 'Autoimmune disease', 'Autoreactive memory, target-cell state, tolerance rebuilding, replacement and recurrence.'],
  ['fibrosis', 'fibrosis', 'Fibrosis', 'Fibrotic disease', 'Mechanical memory, matrix feedback, stromal state, maladaptive repair and reversibility.'],
  ['alzheimers', 'alzheimers', 'Alzheimer’s Disease', 'Neurodegeneration', 'Pre-pathology states, protein context, glial response, network maintenance, resilience and damage.'],
  ['parkinsons', 'parkinsons', 'Parkinson’s Disease', 'Neurodegeneration', 'Mechanistic subtypes, alpha-synuclein state, proteostasis, neuronal vulnerability and resilience.'],
  ['persistent-other', 'persistent-diseases', 'Other Persistent Diseases', 'Cross-disease research', 'Extensible workspace for persistent mechanisms that meet ATLAS evidence-governance requirements.']
].map(([id, slug, name, category, description]) => ({
  id, slug, name, category, description, activeResearchStatus: 'active' as const, curabilityLevel: 'C0' as const, createdAt: now, updatedAt: now
}));

export const evidenceRecords: EvidenceRecord[] = [
  {
    id: 'demo-hiv-reservoir', diseaseIds: ['hiv'], title: 'Reservoir competence demonstration record', sourceType: 'demo',
    sourceName: 'ATLAS deterministic demo dataset', sourceIdentifier: 'atlas-demo://hiv/reservoir-competence', publicationDate: '2026-09-03',
    evidenceLevel: 'hypothesis', studyDesign: 'software demonstration record', populationOrModel: 'No patient or biological model', sampleSize: null,
    finding: 'Demonstrates how reservoir competence can be represented in the Neural Graph; it is not evidence of efficacy or cure.',
    limitations: ['Synthetic demonstration content; not scientific evidence and not suitable for clinical inference.'], safetySignals: [],
    replicationStatus: 'unreplicated', regulatoryStatus: 'not_applicable', confidence: 0.1, status: 'active', demo: true
  },
  {
    id: 'demo-cancer-escape', diseaseIds: ['blood-cancers'], title: 'Target escape demonstration record', sourceType: 'demo',
    sourceName: 'ATLAS deterministic demo dataset', sourceIdentifier: 'atlas-demo://oncology/target-escape', publicationDate: '2026-09-03',
    evidenceLevel: 'hypothesis', studyDesign: 'software demonstration record', populationOrModel: 'No patient or biological model', sampleSize: null,
    finding: 'Demonstrates a target-loss escape edge for UI and integrity testing only.', limitations: ['Synthetic demonstration content.'], safetySignals: [],
    replicationStatus: 'unreplicated', regulatoryStatus: 'not_applicable', confidence: 0.1, status: 'active', demo: true
  },
  {
    id: 'demo-autoimmune-memory', diseaseIds: ['autoimmune-t1d'], title: 'Pathological memory demonstration record', sourceType: 'demo',
    sourceName: 'ATLAS deterministic demo dataset', sourceIdentifier: 'atlas-demo://autoimmune/pathological-memory', publicationDate: '2026-09-03',
    evidenceLevel: 'hypothesis', studyDesign: 'software demonstration record', populationOrModel: 'No patient or biological model', sampleSize: null,
    finding: 'Demonstrates a pathological-memory node without making a treatment claim.', limitations: ['Synthetic demonstration content.'], safetySignals: [],
    replicationStatus: 'unreplicated', regulatoryStatus: 'not_applicable', confidence: 0.1, status: 'active', demo: true
  },
  {
    id: 'demo-fibrosis-memory', diseaseIds: ['fibrosis'], title: 'Mechanical memory demonstration record', sourceType: 'demo',
    sourceName: 'ATLAS deterministic demo dataset', sourceIdentifier: 'atlas-demo://fibrosis/mechanical-memory', publicationDate: '2026-09-03',
    evidenceLevel: 'hypothesis', studyDesign: 'software demonstration record', populationOrModel: 'No patient or biological model', sampleSize: null,
    finding: 'Demonstrates matrix-feedback representation for the research UI.', limitations: ['Synthetic demonstration content.'], safetySignals: [],
    replicationStatus: 'unreplicated', regulatoryStatus: 'not_applicable', confidence: 0.1, status: 'active', demo: true
  },
  {
    id: 'demo-neuro-resilience', diseaseIds: ['alzheimers', 'parkinsons'], title: 'Resilience demonstration record', sourceType: 'demo',
    sourceName: 'ATLAS deterministic demo dataset', sourceIdentifier: 'atlas-demo://neuro/resilience', publicationDate: '2026-09-03',
    evidenceLevel: 'hypothesis', studyDesign: 'software demonstration record', populationOrModel: 'No patient or biological model', sampleSize: null,
    finding: 'Demonstrates how resilience and repairability modifiers can be compared across diseases.', limitations: ['Synthetic demonstration content.'], safetySignals: [],
    replicationStatus: 'unreplicated', regulatoryStatus: 'not_applicable', confidence: 0.1, status: 'active', demo: true
  }
];

export const graphNodes: GraphNode[] = [
  { id: 'hiv-seed', type: 'seed', label: 'Reconstruction-capable seed', description: 'Research representation of a residual state capable of rebuilding disease activity.', diseaseIds: ['hiv'], evidenceRecordIds: ['demo-hiv-reservoir'], confidence: 0.1, status: 'active' },
  { id: 'hiv-niche', type: 'niche', label: 'Protected niche', description: 'Research representation of anatomical or cellular protection.', diseaseIds: ['hiv'], evidenceRecordIds: ['demo-hiv-reservoir'], confidence: 0.1, status: 'active' },
  { id: 'cancer-seed', type: 'seed', label: 'Residual clone', description: 'Research representation of a residual malignant population.', diseaseIds: ['blood-cancers'], evidenceRecordIds: ['demo-cancer-escape'], confidence: 0.1, status: 'active' },
  { id: 'cancer-escape', type: 'immune_escape', label: 'Target escape', description: 'Research representation of an escape state after selective pressure.', diseaseIds: ['blood-cancers'], evidenceRecordIds: ['demo-cancer-escape'], confidence: 0.1, status: 'active' },
  { id: 'autoimmune-memory', type: 'pathological_memory', label: 'Pathological immune memory', description: 'Research representation of memory capable of recreating autoimmune attack.', diseaseIds: ['autoimmune-t1d'], evidenceRecordIds: ['demo-autoimmune-memory'], confidence: 0.1, status: 'active' },
  { id: 'fibrosis-memory', type: 'mechanical_memory', label: 'Mechanical memory', description: 'Research representation of tissue-state feedback that may maintain pathology.', diseaseIds: ['fibrosis'], evidenceRecordIds: ['demo-fibrosis-memory'], confidence: 0.1, status: 'active' },
  { id: 'alz-repair', type: 'repairability', label: 'Network repairability', description: 'Research representation of residual capacity to preserve or restore network function.', diseaseIds: ['alzheimers'], evidenceRecordIds: ['demo-neuro-resilience'], confidence: 0.1, status: 'active' },
  { id: 'pd-repair', type: 'repairability', label: 'Neuronal resilience', description: 'Research representation of residual resilience under pathological stress.', diseaseIds: ['parkinsons'], evidenceRecordIds: ['demo-neuro-resilience'], confidence: 0.1, status: 'active' }
];

export const graphEdges: GraphEdge[] = [
  { id: 'hiv-seed-niche', sourceNodeId: 'hiv-seed', targetNodeId: 'hiv-niche', relationType: 'persists_in', direction: 'forward', evidenceRecordIds: ['demo-hiv-reservoir'], confidence: 0.1, status: 'active', falsificationNotes: ['Demo edge only; requires real evidence before scientific use.'] },
  { id: 'cancer-seed-escape', sourceNodeId: 'cancer-seed', targetNodeId: 'cancer-escape', relationType: 'can_transition_to', direction: 'forward', evidenceRecordIds: ['demo-cancer-escape'], confidence: 0.1, status: 'active', falsificationNotes: ['Demo edge only; requires real evidence before scientific use.'] }
];

export const falsificationRecords: FalsificationRecord[] = [
  {
    id: 'demo-falsification-1', hypothesisOrEdgeId: 'hiv-seed-niche', challengeType: 'demo_counterexample',
    counterexample: 'A valid causal claim would require evidence beyond this synthetic record.', contradictoryEvidenceIds: [],
    escapeRoute: 'Unmodeled reservoir state or niche.', safetyLimitation: 'No therapeutic inference is permitted from demo data.', relapseEvidence: 'No real relapse data in the demo dataset.',
    alternativeExplanations: ['Multiple reservoir states', 'Assay limitations', 'Host-state differences'], evidenceGaps: ['Primary human evidence', 'Independent replication'],
    conclusion: 'Remain hypothesis-level until real evidence is registered.', resultingStatus: 'mixed'
  }
];

export const vulnerabilityProfiles: Record<string, VulnerabilityInput> = Object.fromEntries(
  diseases.map((disease, index) => [disease.id, {
    seedScore: 40 + index * 3, visibilityScore: 50, reservoirScore: 45 + index * 2, nicheScore: 50, adaptationScore: 45,
    repairabilityScore: 50, therapeuticAccessScore: 50, relapseRiskScore: 50, sentinelFitnessDependency: 40,
    surveillanceCostScore: 35, selectionHistoryScore: 40, delegationBurdenScore: 30
  }])
);

export const demoDataNotice = 'Deterministic research/demo content only. No patient data, clinical recommendation, efficacy claim, or live integration is represented.';
