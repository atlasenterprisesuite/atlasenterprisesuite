export type EvidenceLevel = 'human' | 'preclinical' | 'mechanistic' | 'hypothesis';
export type EvidenceStatus = 'active' | 'supported' | 'mixed' | 'contradicted' | 'falsified' | 'retracted' | 'superseded';
export type CurabilityLevel = 'C0' | 'C1' | 'C2' | 'C3' | 'C4' | 'C5' | 'C6' | 'C7';

export interface Disease {
  id: string;
  slug: string;
  name: string;
  category: string;
  description: string;
  activeResearchStatus: string;
  curabilityLevel: CurabilityLevel;
}

export interface EvidenceRecord {
  id: string;
  diseaseIds: string[];
  title: string;
  sourceName: string;
  sourceIdentifier: string;
  evidenceLevel: EvidenceLevel;
  status: EvidenceStatus;
  finding: string;
  limitations: string[];
  safetySignals: string[];
  replicationStatus: string;
}

export interface GraphNode {
  id: string;
  type: string;
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
  evidenceRecordIds: string[];
  confidence: number;
  status: EvidenceStatus;
}

export interface FalsificationRecord {
  id: string;
  challengeType: string;
  counterexample: string;
  escapeRoute: string;
  mitigationStrategy: string;
  conclusion: string;
  resultingStatus: EvidenceStatus;
}

export interface VulnerabilityProfile {
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
  reconstructionRisk: number;
  contributionsByFactor: Record<string, number>;
  formulaVersion: 'v1';
}
