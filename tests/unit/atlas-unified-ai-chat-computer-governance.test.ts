import { describe, expect, it, vi } from 'vitest';
import { createToolGateway } from '../../supabase/functions/atlas-copilot/tool-gateway.mjs';
import { createAtlasAgenticCore } from '../../supabase/functions/atlas-copilot/agentic-core.mjs';

describe('ATLAS managed runtime computer-use governance', () => {
  it('denies computer navigation outside the configured domain allowlist', () => {
    const gateway = createToolGateway({ allowedComputerDomains: ['atlasenterprisesuite.com'] });
    const result = gateway.evaluate({
      context: { permissions: ['computer.use'] },
      proposals: [{
        provider: 'openai',
        runtime: 'openai-agents',
        tool_name: 'computer.navigate',
        arguments: { url: 'https://evil.example/path' },
        target_domain: 'evil.example',
        risk_class: 'read-only',
        required_permissions: ['computer.use'],
        side_effect: 'none',
        cost_class: 'none',
        provider_session_id: 'sess-1',
      }],
    });
    expect(result.denied).toHaveLength(1);
    expect(result.denied[0]).toMatchObject({
      tool_name: 'computer.navigate',
      target_domain: 'evil.example',
      decision_reason: 'domain_not_allowed',
      runtime: 'openai-agents',
      provider_session_id: 'sess-1',
    });
    expect(result.accepted).toHaveLength(0);
  });

  it('allows read-only computer navigation on an allowlisted domain when permission is present', () => {
    const gateway = createToolGateway({ allowedComputerDomains: ['www.atlasenterprisesuite.com'] });
    const result = gateway.evaluate({
      context: { permissions: ['computer.use'] },
      proposals: [{
        provider: 'openai', runtime: 'openai-agents', tool_name: 'computer.navigate',
        arguments: { url: 'https://www.atlasenterprisesuite.com/suite' },
        target_domain: 'www.atlasenterprisesuite.com',
        risk_class: 'read-only', required_permissions: ['computer.use'], side_effect: 'none', cost_class: 'none',
      }],
    });
    expect(result.accepted).toHaveLength(1);
    expect(result.accepted[0].decision_reason).toBe('policy_allowed');
  });

  it('requires approval for a mutating computer-use action on an allowlisted domain', () => {
    const gateway = createToolGateway({ allowedComputerDomains: ['www.atlasenterprisesuite.com'] });
    const result = gateway.evaluate({
      context: { permissions: ['computer.use'] },
      proposals: [{
        provider: 'openai', runtime: 'openai-agents', tool_name: 'computer.click',
        arguments: { selector: '#submit' }, target_domain: 'www.atlasenterprisesuite.com',
        risk_class: 'mutation', required_permissions: ['computer.use'], side_effect: 'external', cost_class: 'none',
        provider_session_id: 'sess-2', provider_turn_id: 'turn-2', provider_call_id: 'call-2',
      }],
    });
    expect(result.approval_required).toHaveLength(1);
    expect(result.approval_required[0]).toMatchObject({
      runtime: 'openai-agents',
      provider_session_id: 'sess-2',
      provider_turn_id: 'turn-2',
      provider_call_id: 'call-2',
      decision_reason: 'side_effect_approval_required',
    });
  });

  it('never trusts runtime-supplied tenant identity over authenticated ATLAS context', async () => {
    const audit = { append: vi.fn() };
    const core = createAtlasAgenticCore({ audit });
    core.registry.register({
      name: 'records.update', module: 'records', operation: 'WRITE', risk_level: 'LOW',
      permission: 'records.write', handler: async () => ({ ok: true }),
    });
    await expect(core.dispatcher.execute({
      context: {
        organization_id: 'org-a', user_id: 'user-1', permissions: ['records.write'],
        session_id: 'session-1', request_id: 'request-1',
      },
      tool_name: 'records.update',
      arguments: { organization_id: 'org-b', id: '1' },
    })).rejects.toMatchObject({ code: 'tenant_mismatch' });
    expect(audit.append).toHaveBeenCalledWith(expect.objectContaining({
      action: 'agent.tool.rejected',
      details: expect.objectContaining({ reason: 'tenant_mismatch' }),
    }));
  });

  it('preserves runtime evidence but strips any runtime claim that a tool already executed', () => {
    const gateway = createToolGateway({ allowedComputerDomains: ['www.atlasenterprisesuite.com'] });
    const result = gateway.evaluate({
      context: { permissions: ['computer.use'] },
      proposals: [{
        provider: 'openai', runtime: 'openai-agents', tool_name: 'computer.navigate',
        arguments: { url: 'https://www.atlasenterprisesuite.com/' }, target_domain: 'www.atlasenterprisesuite.com',
        risk_class: 'read-only', required_permissions: ['computer.use'], side_effect: 'none', cost_class: 'none',
        provider_session_id: 'sess-3', provider_turn_id: 'turn-3', provider_call_id: 'call-3',
        tools_executed: ['computer.navigate'], execution_state: 'completed',
      }],
    });
    expect(result.accepted[0]).toMatchObject({
      runtime: 'openai-agents', target_domain: 'www.atlasenterprisesuite.com', provider_session_id: 'sess-3',
      provider_turn_id: 'turn-3', provider_call_id: 'call-3',
    });
    expect(result.accepted[0]).not.toHaveProperty('tools_executed');
    expect(result.accepted[0]).not.toHaveProperty('execution_state');
  });
});
