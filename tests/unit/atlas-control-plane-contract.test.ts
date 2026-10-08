import { describe, expect, it } from 'vitest';
import {
  ATLAS_CONTROL_PLANE_STAGES,
  validateAtlasControlPlaneHandoff,
  type AtlasCapabilityEnvelope,
  type AtlasContextEnvelope,
  type AtlasEvidenceEnvelope,
  type AtlasIntentEnvelope,
  type AtlasOrchestrationEnvelope,
  type AtlasPolicyEnvelope
} from '../../packages/execution/src';

const intent: AtlasIntentEnvelope = {
  requestId: 'request-1',
  module: 'payroll',
  intent: 'enroll_employee',
  objective: 'Enroll an authorized employee in payroll',
  capabilitiesRequested: ['payroll.enroll']
};

const context: AtlasContextEnvelope = {
  requestId: 'request-1',
  sessionId: 'session-1',
  source: 'server',
  actor: {
    userId: 'user-1',
    scope: { tenantId: 'tenant-1', organizationId: 'org-1' },
    permissions: ['payroll.write']
  }
};

const policy: AtlasPolicyEnvelope = {
  requestId: 'request-1',
  outcome: 'allow',
  reason: 'authorized_reversible_action',
  permissionsRequired: ['payroll.write'],
  approvalId: null
};

const orchestration: AtlasOrchestrationEnvelope = {
  requestId: 'request-1',
  workflowId: 'workflow-1',
  taskId: 'task-1',
  stepId: 'step-1',
  module: 'payroll',
  actionType: 'enroll_employee',
  scope: { tenantId: 'tenant-1', organizationId: 'org-1' }
};

const capability: AtlasCapabilityEnvelope = {
  requestId: 'request-1',
  capabilityId: 'payroll.enroll',
  readiness: 'ready',
  source: 'module_adapter'
};

const evidence: AtlasEvidenceEnvelope = {
  requestId: 'request-1',
  correlationId: 'correlation-1',
  requiredKinds: ['payroll_record'],
  evidence: [
    {
      kind: 'payroll_record',
      reference: 'payroll-77',
      verified: true,
      authenticated: true,
      authoritative: true,
      source: 'payroll:canonical-record',
      observedAt: '2026-10-07T00:00:00.000Z'
    }
  ],
  auditEventIds: ['audit-1']
};

describe('ATLAS control-plane contract', () => {
  it('locks the canonical stage order', () => {
    expect(ATLAS_CONTROL_PLANE_STAGES).toEqual([
      'intent',
      'context',
      'policy',
      'orchestrator',
      'capability',
      'evidence'
    ]);
  });

  it('accepts a fully verified handoff chain', () => {
    expect(validateAtlasControlPlaneHandoff({
      intent,
      context,
      policy,
      orchestration,
      capability,
      evidence
    })).toEqual({
      requestId: 'request-1',
      stage: 'evidence',
      verified: true
    });
  });

  it('rejects context that is not server-resolved', () => {
    expect(() => validateAtlasControlPlaneHandoff({
      intent,
      context: { ...context, source: 'client' as 'server' },
      policy,
      orchestration,
      capability,
      evidence
    })).toThrow('control_plane_context_untrusted');
  });

  it('rejects request lineage mismatches between stages', () => {
    expect(() => validateAtlasControlPlaneHandoff({
      intent,
      context: { ...context, requestId: 'request-2' },
      policy,
      orchestration,
      capability,
      evidence
    })).toThrow('control_plane_request_mismatch:context');
  });

  it('fails closed when an allow decision is missing a required permission', () => {
    expect(() => validateAtlasControlPlaneHandoff({
      intent,
      context: {
        ...context,
        actor: { ...context.actor, permissions: [] }
      },
      policy,
      orchestration,
      capability,
      evidence
    })).toThrow('control_plane_permission_missing:payroll.write');
  });

  it('does not let approval-required policy continue into orchestration', () => {
    expect(() => validateAtlasControlPlaneHandoff({
      intent,
      context,
      policy: {
        ...policy,
        outcome: 'require_approval',
        reason: 'regulated_mutation_requires_approval',
        approvalId: 'approval-1'
      },
      orchestration,
      capability,
      evidence
    })).toThrow('control_plane_policy_not_allowed:require_approval');
  });

  it('preserves tenant and organization scope through orchestration', () => {
    expect(() => validateAtlasControlPlaneHandoff({
      intent,
      context,
      policy,
      orchestration: {
        ...orchestration,
        scope: { tenantId: 'tenant-2', organizationId: 'org-1' }
      },
      capability,
      evidence
    })).toThrow('execution_scope_mismatch');
  });

  it('blocks unavailable capabilities', () => {
    expect(() => validateAtlasControlPlaneHandoff({
      intent,
      context,
      policy,
      orchestration,
      capability: { ...capability, readiness: 'unavailable' },
      evidence
    })).toThrow('control_plane_capability_not_ready:unavailable');
  });

  it('requires verified completion evidence', () => {
    expect(() => validateAtlasControlPlaneHandoff({
      intent,
      context,
      policy,
      orchestration,
      capability,
      evidence: {
        ...evidence,
        evidence: [{
          ...evidence.evidence[0],
          verified: false
        }]
      }
    })).toThrow('execution_evidence_unverified:payroll_record');
  });

  it('requires authenticated authoritative completion evidence', () => {
    expect(() => validateAtlasControlPlaneHandoff({
      intent,
      context,
      policy,
      orchestration,
      capability,
      evidence: {
        ...evidence,
        evidence: [{
          ...evidence.evidence[0],
          authenticated: false
        }]
      }
    })).toThrow('authenticated_execution_evidence_required:payroll_record');
  });

  it('requires an immutable audit reference before completion can be reported', () => {
    expect(() => validateAtlasControlPlaneHandoff({
      intent,
      context,
      policy,
      orchestration,
      capability,
      evidence: { ...evidence, auditEventIds: [] }
    })).toThrow('control_plane_audit_required');
  });
});
