import { describe, expect, it } from 'vitest';
import {
  createAtlasCapabilityCatalog,
  digestApprovalPayload,
  evaluateAtlasPolicy,
  requireControlPlaneEvidence,
  resolveAtlasContext,
  routeSemanticIntent
} from '../../packages/execution/src';

describe('ATLAS unified control-plane facades', () => {
  it('routes semantic intent deterministically from module/capability signals', () => {
    const routed = routeSemanticIntent({
      requestId: 'req-1',
      source: 'assistant',
      objective: 'Enroll this employee in payroll',
      moduleHint: 'payroll',
      requestedCapabilities: ['payroll.enroll']
    }, [
      {
        id: 'payroll.enroll',
        ownerModule: 'payroll',
        capabilities: ['payroll.enroll'],
        signals: ['enroll', 'payroll']
      },
      {
        id: 'hr.profile',
        ownerModule: 'hr',
        capabilities: ['hr.profile.write'],
        signals: ['employee']
      }
    ]);

    expect(routed.ownerModule).toBe('payroll');
    expect(routed.routeId).toBe('payroll.enroll');
    expect(routed.requestedCapabilities).toEqual(['payroll.enroll']);
  });

  it('fails closed on ambiguous semantic intent', () => {
    expect(() => routeSemanticIntent({
      requestId: 'req-2',
      source: 'assistant',
      objective: 'Review account'
    }, [
      { id: 'finance.review', ownerModule: 'finance', capabilities: ['finance.read'], signals: ['review', 'account'] },
      { id: 'accounting.review', ownerModule: 'accounting', capabilities: ['accounting.read'], signals: ['review', 'account'] }
    ])).toThrow('semantic_intent_ambiguous');
  });

  it('normalizes only server-resolved context and preserves scope', () => {
    const context = resolveAtlasContext({
      requestId: 'req-3',
      correlationId: 'corr-3',
      sessionId: 'session-3',
      source: 'server',
      userId: 'user-3',
      tenantId: 'tenant-3',
      organizationId: 'org-3',
      permissions: ['payroll.write', 'payroll.write'],
      roles: ['admin'],
      channel: 'web'
    });

    expect(context.actor.scope).toEqual({ tenantId: 'tenant-3', organizationId: 'org-3' });
    expect(context.actor.permissions).toEqual(['payroll.write']);
    expect(context.correlationId).toBe('corr-3');

    expect(() => resolveAtlasContext({
      requestId: 'req-4',
      sessionId: 'session-4',
      source: 'client' as 'server',
      userId: 'user-4',
      tenantId: 'tenant-4',
      organizationId: 'org-4',
      permissions: []
    })).toThrow('atlas_context_untrusted');
  });

  it('composes permissions, Work policy and payload-bound approvals', async () => {
    const payload = { employeeId: 'employee-42', payGroup: 'weekly' };
    const digest = await digestApprovalPayload(payload);

    const pending = evaluateAtlasPolicy({
      requestId: 'req-5',
      permissions: ['payroll.write'],
      requiredPermissions: ['payroll.write'],
      action: {
        autonomyLevel: 'guided',
        sensitivity: 'critical',
        reversible: false,
        mutation: true,
        paidCost: 0,
        budgetLimit: 0,
        envelopeAllowed: true,
        regulated: true
      },
      payloadVersion: 2,
      payloadDigest: digest,
      approval: null
    });
    expect(pending.outcome).toBe('require_approval');

    const approved = evaluateAtlasPolicy({
      requestId: 'req-5',
      permissions: ['payroll.write'],
      requiredPermissions: ['payroll.write'],
      action: {
        autonomyLevel: 'guided',
        sensitivity: 'critical',
        reversible: false,
        mutation: true,
        paidCost: 0,
        budgetLimit: 0,
        envelopeAllowed: true,
        regulated: true
      },
      payloadVersion: 2,
      payloadDigest: digest,
      approval: {
        status: 'approved',
        payloadVersion: 2,
        payloadDigest: digest
      }
    });
    expect(approved.outcome).toBe('allow');
    expect(approved.approvalSatisfied).toBe(true);
  });

  it('normalizes module/provider/runtime capabilities without replacing their registries', () => {
    const catalog = createAtlasCapabilityCatalog([
      {
        capabilityId: 'documents.generate',
        source: 'module_adapter',
        owner: 'documents',
        readiness: 'ready'
      },
      {
        capabilityId: 'documents.generate',
        source: 'provider_adapter',
        owner: 'provider-a',
        readiness: 'unverified',
        reason: 'probe_required'
      },
      {
        capabilityId: 'browser.execute',
        source: 'runtime',
        owner: 'work-runtime',
        readiness: 'blocked',
        reason: 'runtime_offline'
      }
    ]);

    expect(catalog.readiness('documents.generate').readiness).toBe('ready');
    expect(catalog.list('documents.generate')).toHaveLength(2);
    expect(() => catalog.requireReady('browser.execute')).toThrow('capability_not_ready:blocked');
  });

  it('bridges execution evidence to authenticated authoritative evidence', () => {
    const result = requireControlPlaneEvidence({
      requiredKinds: ['provider_receipt'],
      auditEventIds: ['audit-1'],
      nowMs: Date.parse('2026-10-07T15:00:00.000Z'),
      evidence: [{
        kind: 'provider_receipt',
        reference: 'receipt-1',
        verified: true,
        authenticated: true,
        authoritative: true,
        source: 'provider:test',
        observedAt: '2026-10-07T14:59:00.000Z'
      }]
    });

    expect(result).toHaveLength(1);
    expect(result[0].reference).toBe('receipt-1');

    expect(() => requireControlPlaneEvidence({
      requiredKinds: ['provider_receipt'],
      auditEventIds: ['audit-1'],
      evidence: [{
        kind: 'provider_receipt',
        reference: 'receipt-1',
        verified: true
      }]
    })).toThrow('authenticated_execution_evidence_required:provider_receipt');
  });
});
