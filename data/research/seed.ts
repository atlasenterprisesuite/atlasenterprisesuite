import type { Disease, EvidenceRecord, FalsificationRecord, GraphEdge, GraphNode, VulnerabilityProfile } from '../../packages/health/types';

export const demoDataNotice = 'ATLAS research demo data only - not clinical advice, patient data, or a live production integration.';

export const diseases: Disease[] = [
  { id: 'hiv', slug: 'hiv', name: 'HIV', category: 'Persistent viral disease', description: 'Research workspace for persistence, reservoirs, rebound, immune selection and durable remission evidence.', activeResearchStatus: 'Active research', curabilityLevel: 'C4' },
  { id: 'cancer', slug: 'cancer-leukemia', name: 'Cancer & Leukemias', category: 'Oncology', description: 'Research workspace for clonal heterogeneity, residual disease, target loss, immune escape and relapse.', activeResearchStatus: 'Active research', curabilityLevel: 'C5' },
  { id: 't1d', slug: 'type-1-diabetes-autoimmunity', name: 'Type 1 Diabetes / Autoimmunity', category: 'Autoimmune disease', description: 'Research workspace for autoreactive memory, tolerance, beta-cell state and recurrence.', activeResearchStatus: 'Active research', curabilityLevel: 'C3' },
  { id: 'fibrosis', slug: 'fibrosis', name: 'Fibrosis', category: 'Maladaptive repair', description: 'Research workspace for mechanical memory, matrix feedback, stromal state and reversibility.', activeResearchStatus: 'Active research', curabilityLevel: 'C2' },
  { id: 'alzheimers', slug: 'alzheimers', name: 'Alzheimer’s Disease', category: 'Neurodegeneration', description: 'Research workspace for pre-pathology states, protein context, glial biology, resilience and irreversible damage.', activeResearchStatus: 'Active research', curabilityLevel: 'C2' },
  { id: 'parkinsons', slug: 'parkinsons', name: 'Parkinson’s Disease', category: 'Neurodegeneration', description: 'Research workspace for mechanistic subtypes, proteostasis, mitochondrial stress and neuronal vulnerability.', activeResearchStatus: 'Active research', curabilityLevel: 'C2' }
];

export const evidenceRecords: EvidenceRecord[] = [
  { id: 'e-hiv-1', diseaseIds: ['hiv'], title: 'Reservoir persistence demo record', sourceName: 'ATLAS demo registry', sourceIdentifier: 'DEMO-HIV-001', evidenceLevel: 'human', status: 'active', finding: 'Demo record representing evidence that persistent reservoirs can seed rebound.', limitations: ['Synthetic summary for software validation only.'], safetySignals: [], replicationStatus: 'demo' },
  { id: 'e-cancer-1', diseaseIds: ['cancer'], title: 'Residual-clone demo record', sourceName: 'ATLAS demo registry', sourceIdentifier: 'DEMO-ONC-001', evidenceLevel: 'human', status: 'active', finding: 'Demo record representing residual clonal populations associated with relapse.', limitations: ['Synthetic summary for software validation only.'], safetySignals: [], replicationStatus: 'demo' },
  { id: 'e-t1d-1', diseaseIds: ['t1d'], title: 'Autoreactive-memory demo record', sourceName: 'ATLAS demo registry', sourceIdentifier: 'DEMO-T1D-001', evidenceLevel: 'mechanistic', status: 'active', finding: 'Demo record representing persistent autoreactive memory as a reconstruction factor.', limitations: ['Synthetic summary for software validation only.'], safetySignals: [], replicationStatus: 'demo' },
  { id: 'e-fib-1', diseaseIds: ['fibrosis'], title: 'Mechanical-memory demo record', sourceName: 'ATLAS demo registry', sourceIdentifier: 'DEMO-FIB-001', evidenceLevel: 'preclinical', status: 'active', finding: 'Demo record representing persistent matrix and mechanical feedback.', limitations: ['Synthetic summary for software validation only.'], safetySignals: [], replicationStatus: 'demo' },
  { id: 'e-neuro-1', diseaseIds: ['alzheimers', 'parkinsons'], title: 'Neural resilience demo record', sourceName: 'ATLAS demo registry', sourceIdentifier: 'DEMO-NEURO-001', evidenceLevel: 'hypothesis', status: 'active', finding: 'Demo hypothesis record for resilience and repairability comparisons.', limitations: ['Hypothesis-level synthetic record.'], safetySignals: [], replicationStatus: 'not applicable' }
];

export const graphNodes: GraphNode[] = [
  { id: 'hiv-seed', type: 'seed', label: 'Reservoir seed', description: 'Demo persistent seed state.', diseaseIds: ['hiv'], evidenceRecordIds: ['e-hiv-1'], confidence: 0.82, status: 'supported' },
  { id: 'hiv-niche', type: 'niche', label: 'Protected niche', description: 'Demo protected persistence niche.', diseaseIds: ['hiv'], evidenceRecordIds: ['e-hiv-1'], confidence: 0.76, status: 'supported' },
  { id: 'hiv-relapse', type: 'reconstruction', label: 'Rebound pathway', description: 'Demo reconstruction/rebound state.', diseaseIds: ['hiv'], evidenceRecordIds: ['e-hiv-1'], confidence: 0.79, status: 'supported' },
  { id: 'cancer-seed', type: 'seed', label: 'Residual clone', description: 'Demo residual clonal seed.', diseaseIds: ['cancer'], evidenceRecordIds: ['e-cancer-1'], confidence: 0.84, status: 'supported' },
  { id: 't1d-memory', type: 'pathological_memory', label: 'Autoreactive memory', description: 'Demo autoimmune memory state.', diseaseIds: ['t1d'], evidenceRecordIds: ['e-t1d-1'], confidence: 0.68, status: 'active' },
  { id: 'fib-memory', type: 'mechanical_memory', label: 'Mechanical memory', description: 'Demo fibrotic mechanical-memory state.', diseaseIds: ['fibrosis'], evidenceRecordIds: ['e-fib-1'], confidence: 0.66, status: 'active' },
  { id: 'alz-resilience', type: 'repairability', label: 'Neural resilience', description: 'Demo resilience hypothesis.', diseaseIds: ['alzheimers'], evidenceRecordIds: ['e-neuro-1'], confidence: 0.35, status: 'active' },
  { id: 'pd-resilience', type: 'repairability', label: 'Neuronal resilience', description: 'Demo resilience hypothesis.', diseaseIds: ['parkinsons'], evidenceRecordIds: ['e-neuro-1'], confidence: 0.35, status: 'active' }
];

export const graphEdges: GraphEdge[] = [
  { id: 'hiv-edge-1', sourceNodeId: 'hiv-seed', targetNodeId: 'hiv-niche', relationType: 'persists_in', evidenceRecordIds: ['e-hiv-1'], confidence: 0.78, status: 'supported' },
  { id: 'hiv-edge-2', sourceNodeId: 'hiv-niche', targetNodeId: 'hiv-relapse', relationType: 'can_reconstruct', evidenceRecordIds: ['e-hiv-1'], confidence: 0.74, status: 'supported' }
];

export const falsificationRecords: FalsificationRecord[] = [
  { id: 'f-hiv-1', challengeType: 'Alternative explanation', counterexample: 'Source control alone may not explain durable remission across heterogeneous states.', escapeRoute: 'Protected or transcriptionally quiet states can remain outside the modeled intervention.', mitigationStrategy: 'Require independent evidence for reservoir coverage, rebound and surveillance.', conclusion: 'Keep the reconstruction hypothesis supported but explicitly conditional.', resultingStatus: 'mixed' },
  { id: 'f-neuro-1', challengeType: 'Evidence gap', counterexample: 'A resilience signal does not establish disease reversal.', escapeRoute: 'Irreversible structural loss may dominate even if pathological payload falls.', mitigationStrategy: 'Separate source control, repairability and functional recovery evidence.', conclusion: 'Do not promote resilience hypotheses to cure-level claims.', resultingStatus: 'active' }
];

const profile = (overrides: Partial<VulnerabilityProfile>): VulnerabilityProfile => ({
  seedScore: 60,
  visibilityScore: 45,
  reservoirScore: 60,
  nicheScore: 55,
  adaptationScore: 55,
  repairabilityScore: 50,
  therapeuticAccessScore: 50,
  relapseRiskScore: 60,
  sentinelFitnessDependency: 50,
  surveillanceCostScore: 45,
  selectionHistoryScore: 50,
  delegationBurdenScore: 45,
  ...overrides
});

export const vulnerabilityProfiles: Record<string, VulnerabilityProfile> = {
  hiv: profile({ seedScore: 86, reservoirScore: 90, nicheScore: 82, relapseRiskScore: 88, therapeuticAccessScore: 58 }),
  cancer: profile({ seedScore: 78, adaptationScore: 84, selectionHistoryScore: 82, relapseRiskScore: 76 }),
  t1d: profile({ seedScore: 70, visibilityScore: 48, repairabilityScore: 56, relapseRiskScore: 68 }),
  fibrosis: profile({ seedScore: 58, nicheScore: 72, repairabilityScore: 62, relapseRiskScore: 55 }),
  alzheimers: profile({ seedScore: 52, visibilityScore: 40, repairabilityScore: 25, therapeuticAccessScore: 42, relapseRiskScore: 60 }),
  parkinsons: profile({ seedScore: 54, visibilityScore: 42, repairabilityScore: 28, therapeuticAccessScore: 44, relapseRiskScore: 58 })
};
