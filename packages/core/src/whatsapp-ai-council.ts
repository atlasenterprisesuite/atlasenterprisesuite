export type WhatsAppProvider = 'peach';

export type RawWhatsAppEvent = {
  provider: WhatsAppProvider;
  providerMessageId: string;
  conversationId: string;
  sourcePhone: string;
  businessPhone?: string;
  text: string;
  receivedAt: string;
};

export type NormalizedWhatsAppEvent = {
  provider: WhatsAppProvider;
  providerMessageId: string;
  conversationId: string;
  sourcePhone: string;
  businessPhone?: string;
  text: string;
  receivedAt: string;
};

function requireText(value: string, field: string) {
  if (!value || !value.trim()) {
    throw new Error(`WhatsApp event ${field} is required`);
  }
  return value;
}

export function normalizeWhatsAppEvent(input: RawWhatsAppEvent): NormalizedWhatsAppEvent {
  return {
    provider: input.provider,
    providerMessageId: requireText(input.providerMessageId, 'providerMessageId'),
    conversationId: requireText(input.conversationId, 'conversationId'),
    sourcePhone: requireText(input.sourcePhone, 'sourcePhone'),
    ...(input.businessPhone ? { businessPhone: input.businessPhone } : {}),
    text: requireText(input.text, 'text'),
    receivedAt: requireText(input.receivedAt, 'receivedAt'),
  };
}

export function authorizeWhatsAppSource(
  event: NormalizedWhatsAppEvent,
  allowlist: readonly string[],
) {
  return allowlist.includes(event.sourcePhone);
}


export type AdvisoryOutput = {
  provider: string;
  content: string;
};

export type ChatGPTFinalSynthesis = {
  model: 'chatgpt';
  content: string;
};

export type FinalizeAtlasDecisionInput = {
  runId: string;
  advisoryOutputs: readonly AdvisoryOutput[];
  chatgptFinal?: ChatGPTFinalSynthesis;
};

export type AtlasCouncilDecision = {
  runId: string;
  authority: 'chatgpt';
  content: string;
  advisoryOutputs: readonly AdvisoryOutput[];
};

export class MessageDeduplicator {
  private readonly seen = new Set<string>();

  accept(providerMessageId: string) {
    if (this.seen.has(providerMessageId)) {
      return false;
    }
    this.seen.add(providerMessageId);
    return true;
  }
}

export function finalizeAtlasDecision(
  input: FinalizeAtlasDecisionInput,
): AtlasCouncilDecision {
  if (!input.chatgptFinal?.content.trim()) {
    throw new Error('ChatGPT final synthesis is required before an ATLAS decision can be emitted');
  }

  return {
    runId: input.runId,
    authority: 'chatgpt',
    content: input.chatgptFinal.content,
    advisoryOutputs: input.advisoryOutputs,
  };
}
