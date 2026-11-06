import { describe, expect, it } from 'vitest';
import { previewAlexaSkill } from '../../packages/voice/src/alexaSkillPreview';

const skillId = 'amzn1.ask.skill.11111111-2222-4333-8444-555555555555';
const nowMs = Date.parse('2026-11-06T12:00:00.000Z');

function envelope(type = 'LaunchRequest', intent?: string) {
  return {
    version: '1.0',
    session: {
      application: { applicationId: skillId },
      user: { userId: 'private-amazon-user', accessToken: 'private-token' }
    },
    context: { System: { application: { applicationId: skillId } } },
    request: {
      type,
      requestId: 'EdwRequestId.test-1',
      timestamp: new Date(nowMs).toISOString(),
      ...(intent ? { intent: { name: intent } } : {})
    }
  };
}

const run = (input: unknown) => previewAlexaSkill(input, { skillId, nowMs });

describe('ATLAS Alexa Skill simulation-only boundary', () => {
  it('previews a static, non-personalized launch and never activates hardware', () => {
    const result = run(envelope());
    expect(result.stage).toBe('simulation');
    expect(result.allowed).toBe(true);
    expect(result.outcome).toBe('launch');
    expect(result.response.version).toBe('1.0');
    expect(result.response.response.outputSpeech.type).toBe('PlainText');
    expect(result.response.response.shouldEndSession).toBe(false);
    expect(JSON.stringify(result)).not.toContain('private-amazon-user');
    expect(JSON.stringify(result)).not.toContain('private-token');
  });

  it('offers help without claiming a linked ATLAS account', () => {
    const result = run(envelope('IntentRequest', 'AMAZON.HelpIntent'));
    expect(result.allowed).toBe(true);
    expect(result.outcome).toBe('help');
    expect(JSON.stringify(result).toLowerCase()).not.toContain('connected');
  });

  it('status remains explicitly unavailable without real identity and authorization', () => {
    const result = run(envelope('IntentRequest', 'ATLAS.StatusIntent'));
    expect(result.allowed).toBe(true);
    expect(result.outcome).toBe('status_unavailable');
    expect(result.response.response.shouldEndSession).toBe(true);
    expect(result.response.response.outputSpeech.text).toMatch(/no disponible/i);
  });

  it.each([
    ['wrong skill id', { ...envelope(), session: { application: { applicationId: 'other' } } }],
    ['context mismatch', { ...envelope(), context: { System: { application: { applicationId: 'other' } } } }],
    ['missing session application', { ...envelope(), session: {} }],
    ['null request', { ...envelope(), request: null }],
    ['missing request id', { ...envelope(), request: { type: 'LaunchRequest', timestamp: new Date(nowMs).toISOString() } }],
    ['missing timestamp', { ...envelope(), request: { type: 'LaunchRequest', requestId: 'id' } }],
    ['malformed timestamp', { ...envelope(), request: { ...envelope().request, timestamp: 'no-date' } }],
    ['stale request', { ...envelope(), request: { ...envelope().request, timestamp: new Date(nowMs - 150001).toISOString() } }],
    ['future request', { ...envelope(), request: { ...envelope().request, timestamp: new Date(nowMs + 150001).toISOString() } }],
    ['unknown intent', envelope('IntentRequest', 'ATLAS.GetPayrollIntent')],
    ['unsupported built-in intent', envelope('IntentRequest', 'AMAZON.YesIntent')],
    ['missing intent', envelope('IntentRequest')],
    ['audio event', envelope('AudioPlayer.PlaybackStarted')],
    ['malformed payload', ['LaunchRequest']],
  ])('fails closed for %s', (_label, input) => {
    const result = run(input);
    expect(result.allowed).toBe(false);
    expect(result.outcome).toBe('blocked');
    expect(result.response.response.shouldEndSession).toBe(true);
    expect(JSON.stringify(result)).not.toContain('private-token');
  });

  it('does not accept an empty configured skill id', () => {
    const result = previewAlexaSkill(envelope(), { skillId: '', nowMs });
    expect(result.allowed).toBe(false);
  });
});
