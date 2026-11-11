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

  it('does not turn semantic route capabilities into requested permissions', () => {
    const routed = routeSemanticIntent({
      requestId: 'req-unscoped',
      source: 'assistant',
      objective: 'Review employee payroll information',
      moduleHint: 'payroll'
    }, [{
      id: 'payroll.review',
      ownerModule: 'payroll',
      capabilities: ['payroll.read', 'payroll.write', 'payroll.export'],
      signals: ['payroll', 'review']
    }]);

    expect(routed.routeId).toBe('payroll.review');
    expect(routed.requestedCapabilities).toEqual([]);
  });

});

describe('ATLAS semantic intent AUTH RED regressions', () => {
  const apiIntent = (objective: string, requestedCapabilities: string[] = []) => ({
    requestId: 'auth-red-regression',
    source: 'api' as const,
    objective,
    requestedCapabilities
  });

  it('AUTH-RED-01 rejects priority without any matching evidence', () => {
    expect(() => routeSemanticIntent(apiIntent('weather forecast'), [{
      id: 'privileged', ownerModule: 'payroll',
      capabilities: ['payroll.read', 'payroll.delete'], signals: ['payroll'], priority: 100
    }])).toThrow('semantic_intent_unresolved');
  });

  it('REG-02 prefers a compatible route over an incompatible high-priority route', () => {
    const result = routeSemanticIntent(apiIntent('payroll read', ['payroll.read']), [
      { id: 'delete', ownerModule: 'payroll', capabilities: ['payroll.delete'], signals: ['payroll', 'read'], priority: 500 },
      { id: 'read', ownerModule: 'payroll', capabilities: ['payroll.read'], signals: ['payroll'] }
    ]);
    expect(result.routeId).toBe('read');
  });

  it('SEC-03 rejects a requested capability outside the route contract', () => {
    expect(() => routeSemanticIntent(apiIntent('payroll status', ['payroll.delete']), [{
      id: 'payroll', ownerModule: 'payroll', capabilities: ['payroll.read'], signals: ['payroll']
    }])).toThrow('semantic_intent_capability_unsupported');
  });

  it('SEC-04 preserves a genuine match even when route priority is negative', () => {
    const result = routeSemanticIntent(apiIntent('payroll status', ['payroll.read']), [{
      id: 'payroll', ownerModule: 'payroll',
      capabilities: ['payroll.read'], signals: ['payroll'], priority: -1000
    }]);
    expect(result.routeId).toBe('payroll');
  });

  it('SEC-05 does not interpret a substring inside an unrelated word as a command', () => {
    expect(() => routeSemanticIntent(apiIntent('prepare repayment'), [{
      id: 'payroll', ownerModule: 'payroll', capabilities: ['payroll.read'], signals: ['pay']
    }])).toThrow('semantic_intent_unresolved');
  });

  it('REG-04 treats punctuation in a semantic signal as literal text', () => {
    const result = routeSemanticIntent(apiIntent('execute c++ operation'), [{
      id: 'cpp', ownerModule: 'cpp', capabilities: ['compile'], signals: ['c++']
    }]);
    expect(result.routeId).toBe('cpp');
  });

  it('REG-06 deduplicates explicit capabilities without granting other route capabilities', () => {
    const result = routeSemanticIntent(apiIntent('payroll read', ['payroll.read', 'payroll.read']), [{
      id: 'read', ownerModule: 'payroll',
      capabilities: ['payroll.read', 'payroll.delete'], signals: ['payroll']
    }]);
    expect(result.requestedCapabilities).toEqual(['payroll.read']);
  });
});
