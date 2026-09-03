export type EvidenceLevel =
  | 'human_randomized'
  | 'human_interventional'
  | 'human_observational'
  | 'human_case_report'
  | 'preclinical_animal'
  | 'preclinical_organoid'
  | 'in_vitro'
  | 'mechanistic'
  | 'hypothesis';

export type EvidenceStatus = 'active' | 'supported' | 'mixed' | 'contradicted' | 'falsified' | 'retracted' | 'superseded';
export type ReplicationStatus = 'unreplicated' | 'internally_replicated' | 'independently_replicated';
export type RegulatoryStatus = 'not_applicable' | 'investigational' | 'authorized' | 'approved';
export type SourceType = 'journal' | 'authority' | 'registry' | 'demo';

export interface EvidenceRecord {
  id: string;
  diseaseIds: string[];
  title: string;
  sourceType: SourceType;
  sourceName: string;
  sourceIdentifier: string;
  publicationDate: string;
  evidenceLevel: EvidenceLevel;
  studyDesign: string;
  populationOrModel: string;
  sampleSize: number | null;
  finding: string;
  limitations: string[];
  safetySignals: string[];
  replicationStatus: ReplicationStatus;
  regulatoryStatus: RegulatoryStatus;
  confidence: number;
  status: EvidenceStatus;
  demo: boolean;
}

export type GraphNodeType =
  | 'seed'
  | 'reservoir'
  | 'niche'
  | 'target_state'
  | 'pathological_memory'
  | 'reconstruction_capacity'
  | 'visibility'
  | 'therapeutic_access'
  | 'selection_history'
  | 'immune_escape'
  | 'mechanical_memory'
  | 'maladaptive_repair'
  | 'pathological_inertia'
  | 'regulatory_balance'
  | 'sentinel_fitness'
  | 'surveillance_cost'
  | 'pathological_delegation'
  | 'repairability'
  | 'host_state'
  | 'therapeutic_state';

export interface GraphNode {
  id: string;
  type: GraphNodeType;
  label: string;
  description: string;
  diseaseIds: string[];
  evidenceRecordIds: string[];
  confidence: number;
  status: EvidenceStatus;
}

export interface GraphEdge {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  relationType: string;
  direction: 'forward' | 'bidirectional';
  evidenceRecordIds: string[];
  confidence: number;
  status: EvidenceStatus;
  falsificationNotes: string[];
}

export interface FalsificationRecord {
  id: string;
  hypothesisOrEdgeId: string;
  challengeType: string;
  counterexample: string;
  contradictoryEvidenceIds: string[];
  escapeRoute: string;
  safetyLimitation: string;
  relapseEvidence: string;
  alternativeExplanations: string[];
  evidenceGaps: string[];
  conclusion: string;
  resultingStatus: EvidenceStatus;
}

export type CurabilityLevel = 'C0' | 'C1' | 'C2' | 'C3' | 'C4' | 'C5' | 'C6' | 'C7';

export interface Disease {
  id: string;
  slug: string;
  name: string;
  category: string;
  description: string;
  activeResearchStatus: 'active' | 'watch' | 'stable';
  curabilityLevel: CurabilityLevel;
  createdAt: string;
  updatedAt: string;
}

export interface VulnerabilityInput {
  seedScore: number;
  visibilityScore: number;
  reservoirScore: number;
  nicheScore: number;
  adaptationScore: number;
  repairabilityScore: number;
  therapeuticAccessScore: number;
  relapseRiskScore: number;
  sentinelFitnessDependency: number;
  surveillanceCostScore: number;
  selectionHistoryScore: number;
  delegationBurdenScore: number;
}

export interface VulnerabilityResult {
  researchOnly: true;
  reconstructionRisk: number;
  contributions: Record<string, number>;
  formulaVersion: 'atlas-rve-v1';
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}
