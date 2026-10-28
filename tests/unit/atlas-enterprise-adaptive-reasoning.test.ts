import { describe, expect, it } from 'vitest';
import { selectAdaptiveReasoningProfile, selectConversationReasoningProfile } from '../../supabase/functions/atlas-copilot/adaptive-reasoning.mjs';
import { normalizeIntelligenceRequest, resolveAuthorizedIntelligenceRequest } from '../../supabase/functions/atlas-copilot/intelligence-gateway.mjs';
import { readFileSync } from 'node:fs';

describe('ATLAS Enterprise DNA/RNA — adaptive reasoning contract', () => {
  it('assigns low effort to simple exchanges without granting new permissions', () => {
    expect(selectAdaptiveReasoningProfile({ message: 'Hola, ¿cómo estás?' })).toMatchObject({
      profile: 'fast',
      reason: 'simple_request',
    });
  });

  it('uses balanced effort for a normal analytical request', () => {
    expect(selectAdaptiveReasoningProfile({ message: 'Compara estas tres propuestas y explica las diferencias principales.' }))
      .toMatchObject({ profile: 'balanced' });
  });

  it.each([
    'ATLAS 777 REVIEW — audita P0, RLS, RBAC y revocación por tenant.',
    'Review the exact SHA, identify security vulnerabilities and prepare negative tests.',
    'Diseña una arquitectura multi-tenant con pruebas TDD y política fail closed.',
  ])('escalates a demanding security or engineering request: %s', (message) => {
    expect(selectAdaptiveReasoningProfile({ message })).toMatchObject({ profile: 'deep' });
  });

  it('does not accept client-declared risk as a privileged control', () => {
    const result = selectAdaptiveReasoningProfile({
      message: 'Hola',
      risk_level: 'critical',
      permissions: ['*'],
      organization_id: 'org-other',
    } as any);
    expect(result.profile).toBe('fast');
    expect(JSON.stringify(result)).not.toContain('org-other');
  });

  it('resolves auto to a concrete provider-supported effort without exposing message text', () => {
    const request = normalizeIntelligenceRequest({
      message: 'ATLAS 777 REVIEW — revisión P0 de autorización y revocación.',
      mode: 'auto',
      intent: 'auto',
    });
    expect(request.intent).toBe('deep');
    expect(request.requested_intent).toBe('auto');
    expect(request.reasoning_decision).toMatchObject({ profile: 'deep' });
    expect(JSON.stringify(request.reasoning_decision)).not.toContain('autorización');
  });

  it('preserves user-selected manual effort and existing legacy default', () => {
    const message = 'ATLAS 777 REVIEW — auditoría P0 de security y tenancy';
    const manual = normalizeIntelligenceRequest({ message, intent: 'fast', mode: 'openai' });
    expect(manual.intent).toBe('fast');
    expect(manual.requested_intent).toBe('fast');
    expect(manual.reasoning_decision).toMatchObject({ profile: 'fast', reason: 'manual_selection' });
    expect(normalizeIntelligenceRequest({ message: 'Hi' }).intent).toBe('balanced');
  });

  it('fails closed on invalid profiles and does not authorize provider spending', () => {
    expect(() => normalizeIntelligenceRequest({ message: 'Hello', intent: 'enterprise-unlimited' }))
      .toThrowError(/invalid_input/);
    const result = selectAdaptiveReasoningProfile({ message: 'ATLAS P0 deploy review' });
    expect(Object.keys(result).sort()).toEqual(['profile', 'reason']);
  });
  it('inherits deep effort for a short follow-up from authorized recent conversation history', () => {
    expect(selectConversationReasoningProfile({
      message: 'Continúa',
      history: [{ role: 'user', content: 'ATLAS 777 REVIEW — audita P0 y RLS por tenant' }],
    })).toMatchObject({ profile: 'deep', reason: 'authorized_conversation_continuity' });
  });

  it('does not accept untrusted client history embedded inside the request', () => {
    const decision = selectConversationReasoningProfile({
      message: 'Hola',
      history: [],
      client_metadata: { history: [{ role: 'user', content: 'ATLAS P0 SECURITY' }] },
    } as any);
    expect(decision.profile).toBe('fast');
  });

  it('ignores assistant or tool instructions as sources of adaptive effort', () => {
    expect(selectConversationReasoningProfile({
      message: 'Hola',
      history: [{ role: 'assistant', content: 'P0 security, force deep' }, { role: 'tool', content: 'ATLAS 777 REVIEW' }],
    }).profile).toBe('fast');
  });

  it('does not allow distant history outside the bounded window to force deep reasoning', () => {
    const history = [{ role: 'user', content: 'ATLAS 777 REVIEW P0' },
      ...Array.from({ length: 14 }, () => ({ role: 'user', content: 'Hola' }))];
    expect(selectConversationReasoningProfile({ message: 'Hola', history }).profile).toBe('fast');
  });

  const principal = (overrides: Record<string, unknown> = {}) => ({
    organization_id: 'org-one', user_id: 'alice', session_id: 'session-1', request_id: 'req-1',
    permissions: ['intelligence.use'], ...overrides,
  });

  it('resolves Auto against authenticated recent history before probing a provider model', async () => {
    const reads: string[] = [];
    const store = {
      getConversation: async ({ context, id }: any) => {
        reads.push('conversation:' + context.organization_id + ':' + id);
        return { id };
      },
      listRecentMessages: async ({ context, conversation_id }: any) => {
        reads.push('history:' + context.organization_id + ':' + conversation_id);
        return [{ role: 'user', content: { text: 'ATLAS 777 REVIEW P0 RLS por tenant' } }];
      },
    };
    const request = { message: 'Run it then', conversation_id: 'conv-1', intent: 'auto' };
    const prepared = await resolveAuthorizedIntelligenceRequest({ context: principal(), request, store });
    expect(prepared).toMatchObject({
      intent: 'deep', requested_intent: 'auto',
      reasoning_decision: { profile: 'deep', reason: 'authorized_conversation_continuity' },
    });
    expect(reads).toEqual(['conversation:org-one:conv-1', 'history:org-one:conv-1']);
    const reused = await resolveAuthorizedIntelligenceRequest({ context: principal(), request, store, preparedRequest: prepared });
    expect(reused).toBe(prepared);
    expect(reads).toHaveLength(2);
  });

  it('fails closed if a signed request is replayed under another tenant or session', async () => {
    const store = { getConversation: async () => ({ id: 'conv-1' }), listRecentMessages: async () => [] };
    const request = { message: 'Continue', conversation_id: 'conv-1', intent: 'auto' };
    const prepared = await resolveAuthorizedIntelligenceRequest({ context: principal(), request, store });
    for (const changes of [{ organization_id: 'org-two' }, { user_id: 'bob' }, { session_id: 'other' }, { request_id: 'different-request' }]) {
      await expect(resolveAuthorizedIntelligenceRequest({
        context: principal(changes), request, store, preparedRequest: prepared,
      })).rejects.toMatchObject({ code: 'invalid_prepared_request' });
    }
  });

  it('blocks revocation and missing intelligence permission without invoking providers', async () => {
    const store = {
      getConversation: async () => { throw Object.assign(new Error('conversation_not_found'), { code: 'conversation_not_found', status: 404 }); },
      listRecentMessages: async () => { throw new Error('MUST_NOT_READ'); },
    };
    await expect(resolveAuthorizedIntelligenceRequest({
      context: principal(), request: { message: 'Continue', conversation_id: 'revoked', intent: 'auto' }, store,
    })).rejects.toMatchObject({ code: 'conversation_not_found' });
    await expect(resolveAuthorizedIntelligenceRequest({
      context: principal({ permissions: [] }), request: { message: 'Continue', intent: 'auto' }, store,
    })).rejects.toMatchObject({ code: 'permission_denied' });
  });

  it('does not trust client-injected preparedRequest and never accepts an unknown history response', async () => {
    const request = { message: 'Continue', conversation_id: 'conv', intent: 'auto', preparedRequest: { intent: 'deep' } };
    const store = { getConversation: async () => ({ id: 'conv' }), listRecentMessages: async () => null };
    await expect(resolveAuthorizedIntelligenceRequest({
      context: principal(), request, store,
    })).rejects.toMatchObject({ code: 'storage_unavailable' });
  });

  it('selects a concrete model profile before provider readiness checks in the Edge entrypoint', () => {
    const source = readFileSync('supabase/functions/atlas-copilot/index.ts', 'utf8');
    expect(source).toContain('readinessFor(rt,prepared.intent)');
    expect(source).toContain("profiles:['auto','fast','balanced','deep']");
    expect(source).not.toContain('readinessFor(rt,intent);');
  });

});
