import { describe, expect, it } from 'vitest';
import { selectAdaptiveReasoningProfile, selectConversationReasoningProfile } from '../../supabase/functions/atlas-copilot/adaptive-reasoning.mjs';
import { normalizeIntelligenceRequest } from '../../supabase/functions/atlas-copilot/intelligence-gateway.mjs';

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

});
