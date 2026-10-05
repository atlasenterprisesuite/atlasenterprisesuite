export type DependencyRisk = 'P0' | 'P1' | 'P2';

export type DependencyNodeKind =
  | 'module'
  | 'route'
  | 'component'
  | 'package'
  | 'source_file'
  | 'edge_function'
  | 'database_object'
  | 'rls_policy'
  | 'permission'
  | 'provider'
  | 'provider_capability'
  | 'workflow'
  | 'test_suite'
  | 'runtime_endpoint'
  | 'evidence_requirement'
  | 'secret_requirement';

export type DependencyEdgeKind =
  | 'contains'
  | 'imports'
  | 'routes_to'
  | 'calls'
  | 'reads'
  | 'writes'
  | 'requires_permission'
  | 'requires_provider'
  | 'requires_capability'
  | 'requires_secret'
  | 'verified_by'
  | 'tested_by'
  | 'deployed_by'
  | 'depends_on'
  | 'supersedes'
  | 'evidence_for';

export type DependencyProvenance =
  | 'static_discovery'
  | 'declared_manifest'
  | 'migration_discovery'
  | 'runtime_observation'
  | 'evidence_registry'
  | 'operator_override';

export type VerificationRequirement = {
  id: string;
  kind: 'global' | 'focused';
  reason: string;
  hardGate: boolean;
};

export type DependencyNode = {
  id: string;
  kind: DependencyNodeKind;
  label: string;
  risk: DependencyRisk;
  metadata?: Record<string, unknown>;
  verification?: readonly VerificationRequirement[];
};

export type DependencyEdge = {
  from: string;
  to: string;
  kind: DependencyEdgeKind;
  provenance: DependencyProvenance;
};

export type DependencyGraph = {
  nodes: readonly DependencyNode[];
  edges: readonly DependencyEdge[];
};

export type UnresolvedDependency = {
  id: string;
  risk: DependencyRisk;
  reason: string;
};

export type ImpactExplanation = {
  targetId: string;
  path: readonly string[];
};

export type ImpactRecommendation =
  | 'CLEAR'
  | 'CLEAR_WITH_WARNINGS'
  | 'HOLD_MISSING_VERIFICATION'
  | 'HOLD_UNKNOWN_DEPENDENCY'
  | 'BLOCKED_HARD_GATE_FAILURE';

export type ImpactReport = {
  risk: DependencyRisk;
  direct: readonly string[];
  transitive: readonly string[];
  requiredVerification: readonly VerificationRequirement[];
  unresolved: readonly UnresolvedDependency[];
  explanations: readonly ImpactExplanation[];
  recommendation: ImpactRecommendation;
};
