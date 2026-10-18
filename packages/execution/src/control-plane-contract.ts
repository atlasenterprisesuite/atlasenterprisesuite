import { assertSameScope } from './context';
import {
  requireControlPlaneEvidence,
  type AtlasExecutionEvidenceRecord
} from './evidence-bridge';
import type { ExecutionActor, ExecutionScope } from './types';
import type { WorkActionPolicyDecision } from './work-policy';

export const ATLAS_CONTROL_PLANE_STAGES = [
  'intent',
  'context',
  'policy',
  'orchestrator',
  'capability',
  'evidence'
] as const;

export type AtlasControlPlaneStage = (typeof ATLAS_CONTROL_PLANE_STAGES)[number];

export const ATLAS_CONTROL_PLANE_OWNERS = Object.freeze({
  intent: Object.freeze({
    path: 'packages/execution/src/semantic-intent.ts',
    symbol: 'routeSemanticIntent'
  }),
  context: Object.freeze({
    path: 'packages/execution/src/context-engine.ts',
    symbol: 'resolveAtlasContext'
  }),
  policy: Object.freeze({
    path: 'packages/execution/src/policy-fabric.ts',
    symbol: 'evaluateAtlasPolicy'
  }),
  orchestrator: Object.freeze({
    path: 'packages/execution/src/engine.ts',
    symbol: 'ExecutionEngine'
  }),
  capability: Object.freeze({
    path: 'packages/execution/src/capability-catalog.ts',
    symbol: 'createAtlasCapabilityCatalog'
  }),
  evidence: Object.freeze({
    path: 'packages/execution/src/evidence-bridge.ts',
    symbol: 'requireControlPlaneEvidence'
  })
} satisfies Record<AtlasControlPlaneStage, { path: string; symbol: string }>);

export type AtlasIntentEnvelope = {
  requestId: string;
  module: string;
  intent: string;
  objective: string;
  capabilitiesRequested: readonly string[];
};

export type AtlasContextEnvelope = {
  requestId: string;
  sessionId: string;
  source: 'server';
  actor: ExecutionActor;
};

export type AtlasPolicyEnvelope = {
  requestId: string;
  outcome: WorkActionPolicyDecision['outcome'];
  reason: string;
  permissionsRequired: readonly string[];
  approvalId: string | null;
};

export type AtlasOrchestrationEnvelope = {
  requestId: string;
  workflowId: string;
  taskId: string;
  stepId: string;
  module: string;
  actionType: string;
  scope: ExecutionScope;
};

export type AtlasCapabilityEnvelope = {
  requestId: string;
  capabilityId: string;
  readiness: 'ready' | 'blocked' | 'unavailable';
  source: 'module_adapter' | 'provider_adapter' | 'runtime';
};

export type AtlasEvidenceEnvelope = {
  requestId: string;
  correlationId: string;
  requiredKinds: readonly string[];
  evidence: readonly AtlasExecutionEvidenceRecord[];
  auditEventIds: readonly string[];
};

export type AtlasControlPlaneHandoff = {
  intent: AtlasIntentEnvelope;
  context: AtlasContextEnvelope;
  policy: AtlasPolicyEnvelope;
  orchestration: AtlasOrchestrationEnvelope;
  capability: AtlasCapabilityEnvelope;
  evidence: AtlasEvidenceEnvelope;
};

export type AtlasControlPlaneVerification = {
  requestId: string;
  stage: 'evidence';
  verified: true;
};

function nonEmpty(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0;
}

function assertLineage(intent: AtlasIntentEnvelope, stage: AtlasControlPlaneStage, requestId: string) {
  if (requestId !== intent.requestId) {
    throw new Error(`control_plane_request_mismatch:${stage}`);
  }
}

function assertIntent(intent: AtlasIntentEnvelope) {
  if (!nonEmpty(intent.requestId)) throw new Error('control_plane_request_id_required');
  if (!nonEmpty(intent.module)) throw new Error('control_plane_intent_module_required');
  if (!nonEmpty(intent.intent)) throw new Error('control_plane_intent_required');
  if (!nonEmpty(intent.objective)) throw new Error('control_plane_objective_required');
  if (!Array.isArray(intent.capabilitiesRequested) || !intent.capabilitiesRequested.length) {
    throw new Error('control_plane_capability_request_required');
  }
  if (intent.capabilitiesRequested.some((capability) => !nonEmpty(capability))) {
    throw new Error('control_plane_capability_request_invalid');
  }
}

function assertContext(intent: AtlasIntentEnvelope, context: AtlasContextEnvelope) {
  assertLineage(intent, 'context', context.requestId);
  if (context.source !== 'server') throw new Error('control_plane_context_untrusted');
  if (!nonEmpty(context.sessionId)) throw new Error('control_plane_session_required');
  if (!nonEmpty(context.actor?.userId)) throw new Error('control_plane_actor_required');
  if (!nonEmpty(context.actor?.scope?.tenantId) || !nonEmpty(context.actor?.scope?.organizationId)) {
    throw new Error('control_plane_scope_required');
  }
}

function assertPolicy(
  intent: AtlasIntentEnvelope,
  context: AtlasContextEnvelope,
  policy: AtlasPolicyEnvelope
) {
  assertLineage(intent, 'policy', policy.requestId);
  if (!nonEmpty(policy.reason)) throw new Error('control_plane_policy_reason_required');

  if (policy.outcome === 'allow') {
    for (const permission of policy.permissionsRequired) {
      const allowed = context.actor.permissions.includes(permission)
        || context.actor.permissions.includes('*')
        || context.actor.permissions.includes('execution.admin');
      if (!allowed) throw new Error(`control_plane_permission_missing:${permission}`);
    }
  }
}

function assertOrchestration(
  intent: AtlasIntentEnvelope,
  context: AtlasContextEnvelope,
  policy: AtlasPolicyEnvelope,
  orchestration: AtlasOrchestrationEnvelope
) {
  assertLineage(intent, 'orchestrator', orchestration.requestId);
  if (policy.outcome !== 'allow') {
    throw new Error(`control_plane_policy_not_allowed:${policy.outcome}`);
  }
  if (
    !nonEmpty(orchestration.workflowId)
    || !nonEmpty(orchestration.taskId)
    || !nonEmpty(orchestration.stepId)
    || !nonEmpty(orchestration.module)
    || !nonEmpty(orchestration.actionType)
  ) {
    throw new Error('control_plane_orchestration_identity_required');
  }
  assertSameScope(context.actor.scope, orchestration.scope);
}

function assertCapability(intent: AtlasIntentEnvelope, capability: AtlasCapabilityEnvelope) {
  assertLineage(intent, 'capability', capability.requestId);
  if (!nonEmpty(capability.capabilityId)) throw new Error('control_plane_capability_id_required');
  if (capability.readiness !== 'ready') {
    throw new Error(`control_plane_capability_not_ready:${capability.readiness}`);
  }
}

function assertEvidence(intent: AtlasIntentEnvelope, evidence: AtlasEvidenceEnvelope) {
  assertLineage(intent, 'evidence', evidence.requestId);
  if (!nonEmpty(evidence.correlationId)) throw new Error('control_plane_correlation_required');

  requireControlPlaneEvidence({
    requiredKinds: evidence.requiredKinds,
    evidence: evidence.evidence,
    auditEventIds: evidence.auditEventIds
  });
}

export function validateAtlasControlPlaneHandoff(
  handoff: AtlasControlPlaneHandoff
): AtlasControlPlaneVerification {
  assertIntent(handoff.intent);
  assertContext(handoff.intent, handoff.context);
  assertPolicy(handoff.intent, handoff.context, handoff.policy);
  assertOrchestration(handoff.intent, handoff.context, handoff.policy, handoff.orchestration);
  assertCapability(handoff.intent, handoff.capability);
  assertEvidence(handoff.intent, handoff.evidence);

  return {
    requestId: handoff.intent.requestId,
    stage: 'evidence',
    verified: true
  };
}
