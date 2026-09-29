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
