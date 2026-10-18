import { describe, expect, it, vi } from 'vitest';
import { createAtlasAgenticCore } from '../../supabase/functions/atlas-copilot/agentic-core.mjs';

function agentContext(overrides: Record<string, unknown> = {}) {
  return {
    organization_id: 'org-1',
    user_id: 'user-1',
    permissions: ['payroll.approve'],
    roles: ['operator'],
    session_id: 'session-1',
    request_id: 'request-1',
    ...overrides
  };
}

function auditSink() {
  const events: Array<Record<string, any>> = [];
  return {
    events,
    append(event: Record<string, any>) {
      events.push(event);
    }
  };
}

function approvalStore(toolName = 'payroll.approve') {
  return {
    list() {
      return [{
        id: 'approval-1',
        status: 'approved',
        subject_type: 'agent_tool',
        subject_id: toolName
      }];
    }
  };
}

function registerGovernedPayrollTool(core: ReturnType<typeof createAtlasAgenticCore>) {
  const handler = vi.fn(async () => ({ ok: true }));
  core.registry.register({
    name: 'payroll.approve',
    module: 'payroll',
    operation: 'WRITE',
    risk_level: 'HIGH',
    permission: 'payroll.approve',
    stewardship: {
      purpose: 'payroll.approve',
      evidenceRequired: true,
      approvalRequired: true
    },
    handler
  });
  return handler;
}

const baselineStewardship = {
  actorId: 'user-1',
  actorType: 'human',
  purpose: 'payroll.approve',
  assurance: 'baseline',
  evidenceRefs: ['evidence-1'],
  correlationId: 'corr-1'
} as const;

const verifiedStewardship = {
  ...baselineStewardship,
  assurance: 'verified'
} as const;

describe('ATLAS agentic stewardship integration', () => {
  it('denies a governed R2 tool when trusted resolver returns baseline assurance', async () => {
    const audit = auditSink();
    const core = createAtlasAgenticCore({
      approvals: approvalStore(),
      audit,
      resolveStewardshipContext: () => baselineStewardship
    });
    const handler = registerGovernedPayrollTool(core);

    await expect(core.dispatcher.execute({
      context: agentContext(),
      tool_name: 'payroll.approve',
      arguments: { organization_id: 'org-1' },
      approval_id: 'approval-1'
    })).rejects.toMatchObject({ code: 'assurance_insufficient' });
    expect(handler).not.toHaveBeenCalled();
  });

  it('ignores elevated assurance supplied by the request context', async () => {
    const audit = auditSink();
    const core = createAtlasAgenticCore({
      approvals: approvalStore(),
      audit,
      resolveStewardshipContext: () => baselineStewardship
    });
    const handler = registerGovernedPayrollTool(core);

    await expect(core.dispatcher.execute({
      context: agentContext({
        assurance: 'elevated',
        evidenceRefs: ['request-fabricated-evidence'],
        stewardship: { assurance: 'elevated' }
      }),
      tool_name: 'payroll.approve',
      arguments: { organization_id: 'org-1' },
      approval_id: 'approval-1'
    })).rejects.toMatchObject({ code: 'assurance_insufficient' });
    expect(handler).not.toHaveBeenCalled();
  });

  it('fails closed for a governed R2 tool when the trusted resolver is absent', async () => {
    const audit = auditSink();
    const core = createAtlasAgenticCore({ approvals: approvalStore(), audit });
    const handler = registerGovernedPayrollTool(core);

    await expect(core.dispatcher.execute({
      context: agentContext(),
      tool_name: 'payroll.approve',
      arguments: { organization_id: 'org-1' },
      approval_id: 'approval-1'
    })).rejects.toMatchObject({ code: 'assurance_insufficient' });
    expect(handler).not.toHaveBeenCalled();
  });

  it('allows a governed R2 tool with verified trusted assurance, evidence, permission and approval', async () => {
    const audit = auditSink();
    const core = createAtlasAgenticCore({
      approvals: approvalStore(),
      audit,
      resolveStewardshipContext: () => verifiedStewardship
    });
    const handler = registerGovernedPayrollTool(core);

    await expect(core.dispatcher.execute({
      context: agentContext(),
      tool_name: 'payroll.approve',
      arguments: { organization_id: 'org-1' },
      approval_id: 'approval-1'
    })).resolves.toEqual({ ok: true });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('keeps canonical permission denial authoritative even with elevated stewardship', async () => {
    const audit = auditSink();
    const core = createAtlasAgenticCore({
      approvals: approvalStore(),
      audit,
      resolveStewardshipContext: () => ({ ...verifiedStewardship, assurance: 'elevated' })
    });
    const handler = registerGovernedPayrollTool(core);

    await expect(core.dispatcher.execute({
      context: agentContext({ permissions: [] }),
      tool_name: 'payroll.approve',
      arguments: { organization_id: 'org-1' },
      approval_id: 'approval-1'
    })).rejects.toMatchObject({ code: 'permission_denied' });
    expect(handler).not.toHaveBeenCalled();
  });

  it('keeps organization mismatch authoritative even with elevated stewardship', async () => {
    const audit = auditSink();
    const core = createAtlasAgenticCore({
      approvals: approvalStore(),
      audit,
      resolveStewardshipContext: () => ({ ...verifiedStewardship, assurance: 'elevated' })
    });
    const handler = registerGovernedPayrollTool(core);

    await expect(core.dispatcher.execute({
      context: agentContext(),
      tool_name: 'payroll.approve',
      arguments: { organization_id: 'org-2' },
      approval_id: 'approval-1'
    })).rejects.toMatchObject({ code: 'tenant_mismatch' });
    expect(handler).not.toHaveBeenCalled();
  });

  it('preserves legacy behavior for a tool without stewardship configuration', async () => {
    const audit = auditSink();
    const core = createAtlasAgenticCore({ audit });
    const handler = vi.fn(async () => ({ legacy: true }));
    core.registry.register({
      name: 'knowledge.read',
      module: 'knowledge',
      operation: 'READ',
      risk_level: 'LOW',
      permission: 'knowledge.read',
      handler
    });

    await expect(core.dispatcher.execute({
      context: agentContext({ permissions: ['knowledge.read'] }),
      tool_name: 'knowledge.read',
      arguments: {}
    })).resolves.toEqual({ legacy: true });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('writes whitelisted stewardship evidence to governed audit details without request secrets', async () => {
    const audit = auditSink();
    const core = createAtlasAgenticCore({
      approvals: approvalStore(),
      audit,
      resolveStewardshipContext: () => verifiedStewardship
    });
    registerGovernedPayrollTool(core);

    await core.dispatcher.execute({
      context: agentContext({ assurance: 'elevated' }),
      tool_name: 'payroll.approve',
      arguments: { organization_id: 'org-1', token: 'super-secret' },
      approval_id: 'approval-1'
    });

    const authorized = audit.events.find(event => event.action === 'agent.tool.authorized');
    expect(authorized?.details?.stewardship).toEqual({
      purpose: 'payroll.approve',
      stewardshipRisk: 'R2',
      assurance: 'verified',
      policyDecision: 'allowed',
      evidenceRefs: ['evidence-1'],
      correlationId: 'corr-1'
    });
    expect(JSON.stringify(audit.events)).not.toContain('super-secret');
  });
});
