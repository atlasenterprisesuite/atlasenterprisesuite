import { describe, expect, it } from 'vitest';
import {
  authorizeWhatsAppSource,
  normalizeWhatsAppEvent,
  MessageDeduplicator,
  finalizeAtlasDecision,
} from '../../packages/core/src/whatsapp-ai-council';

describe('ATLAS WhatsApp AI Council inbound gate', () => {
  it('normalizes a valid inbound WhatsApp event', () => {
    const event = normalizeWhatsAppEvent({
      provider: 'peach',
      providerMessageId: 'wamid.123',
      conversationId: '42',
      sourcePhone: '+17867849945',
      businessPhone: '+14075550100',
      text: 'ATLAS TEST DIRECT',
      receivedAt: '2026-09-29T13:00:00.000Z',
    });

    expect(event).toEqual({
      provider: 'peach',
      providerMessageId: 'wamid.123',
      conversationId: '42',
      sourcePhone: '+17867849945',
      businessPhone: '+14075550100',
      text: 'ATLAS TEST DIRECT',
      receivedAt: '2026-09-29T13:00:00.000Z',
    });
  });

  it('rejects an inbound event with blank text', () => {
    expect(() =>
      normalizeWhatsAppEvent({
        provider: 'peach',
        providerMessageId: 'wamid.124',
        conversationId: '43',
        sourcePhone: '+17867849945',
        text: '   ',
        receivedAt: '2026-09-29T13:00:01.000Z',
      }),
    ).toThrow(/text/i);
  });

  it('fails closed for a source that is not allowlisted', () => {
    const event = normalizeWhatsAppEvent({
      provider: 'peach',
      providerMessageId: 'wamid.125',
      conversationId: '44',
      sourcePhone: '+17867849945',
      text: 'run atlas',
      receivedAt: '2026-09-29T13:00:02.000Z',
    });

    expect(authorizeWhatsAppSource(event, ['+14075550111'])).toBe(false);
    expect(authorizeWhatsAppSource(event, ['+17867849945'])).toBe(true);
  });
});

describe('ATLAS WhatsApp AI Council authority and idempotency', () => {
  it('rejects duplicate provider message IDs', () => {
    const deduplicator = new MessageDeduplicator();

    expect(deduplicator.accept('wamid.dup')).toBe(true);
    expect(deduplicator.accept('wamid.dup')).toBe(false);
  });

  it('does not finalize an advisory-only run', () => {
    expect(() =>
      finalizeAtlasDecision({
        runId: 'run-1',
        advisoryOutputs: [
          { provider: 'gemini', content: 'proposal' },
          { provider: 'copilot', content: 'implementation note' },
        ],
      }),
    ).toThrow(/ChatGPT/i);
  });

  it('emits a decision only when ChatGPT provides the final synthesis', () => {
    const decision = finalizeAtlasDecision({
      runId: 'run-2',
      advisoryOutputs: [{ provider: 'gemini', content: 'research' }],
      chatgptFinal: {
        model: 'chatgpt',
        content: 'ATLAS final conclusion',
      },
    });

    expect(decision.authority).toBe('chatgpt');
    expect(decision.content).toBe('ATLAS final conclusion');
    expect(decision.runId).toBe('run-2');
  });
});
