import { sameScope, type TenantScope } from '../core/src';

export type DecisionTruthState =
  | 'reflection'
  | 'needs_evidence'
  | 'evidence_found'
  | 'action_proposed'
  | 'blocked'
  | 'verified'
  | 'rejected'
  | 'superseded';

export type DecisionRisk = 'low' | 'medium' | 'high' | 'critical';

export type DecisionSignalKind =
  | 'symbolic'
  | 'intuition'
  | 'observation'
  | 'user-note'
  | 'ai-reflection';

export type DecisionEvidenceRef = {
  id?: string;
  kind: string;
  sourceModule: string;
  sourceId: string;
  label: string;
  verifiedAt?: string;
};

export type VerificationGateItem = {
  id: string;
  label: string;
  passed: boolean;
  evidenceRefIds?: string[];
};

export type DecisionCompassRecord = TenantScope & {
  id: string;
  createdBy: string;
  createdAt: string;
  signalKind: DecisionSignalKind;
  signalLabel: string;
  signalText: string;
  interpretation: string;
  targetModule: string | null;
  evidenceRefs: DecisionEvidenceRef[];
  risk: DecisionRisk;
  proposedAction: string | null;
  verificationGate: VerificationGateItem[];
  truthState: DecisionTruthState;
  verifiedBy: string | null;
  verifiedAt: string | null;
};

export type DecisionTransitionContext = {
  actorId: string;
  at?: string;
};

export type VerificationGateEvaluation = {
  ready: boolean;
  missing: string[];
};

const allowedTransitions: Record<DecisionTruthState, readonly DecisionTruthState[]> = {
  reflection: ['needs_evidence', 'blocked', 'rejected', 'superseded'],
  needs_evidence: ['evidence_found', 'blocked', 'rejected', 'superseded'],
  evidence_found: ['needs_evidence', 'action_proposed', 'blocked', 'rejected', 'superseded'],
  action_proposed: ['evidence_found', 'blocked', 'verified', 'rejected', 'superseded'],
  blocked: ['needs_evidence', 'evidence_found', 'action_proposed', 'rejected', 'superseded'],
  verified: ['superseded'],
  rejected: ['superseded'],
  superseded: []
};

export function canTransitionDecision(from: DecisionTruthState, to: DecisionTruthState) {
  return allowedTransitions[from].includes(to);
}

export function evaluateVerificationGate(record: Pick<DecisionCompassRecord, 'evidenceRefs' | 'verificationGate'>): VerificationGateEvaluation {
  const missing: string[] = [];

  if (record.evidenceRefs.length === 0) missing.push('independent_evidence');
  if (record.verificationGate.length === 0) missing.push('verification_gate');

  for (const gate of record.verificationGate) {
    if (!gate.passed) missing.push(gate.label);
  }

  return { ready: missing.length === 0, missing };
}

export function assertDecisionScope(record: TenantScope, activeScope: TenantScope) {
  if (!sameScope(record, activeScope)) throw new Error('decision_scope_mismatch');
}

export function transitionDecision(
  record: DecisionCompassRecord,
  nextState: DecisionTruthState,
  context: DecisionTransitionContext
): DecisionCompassRecord {
  if (!context.actorId.trim()) throw new Error('decision_actor_required');
  if (!canTransitionDecision(record.truthState, nextState)) {
    throw new Error('invalid_truth_state_transition');
  }

  if (nextState === 'verified') {
    const gate = evaluateVerificationGate(record);
    if (!gate.ready) throw new Error(`verification_gate_incomplete:${gate.missing.join(',')}`);

    return {
      ...record,
      truthState: 'verified',
      verifiedBy: context.actorId,
      verifiedAt: context.at || new Date().toISOString()
    };
  }

  return {
    ...record,
    truthState: nextState
  };
}
