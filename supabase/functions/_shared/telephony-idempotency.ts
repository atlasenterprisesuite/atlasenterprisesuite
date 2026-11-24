export type NormalizedCallMutationInput = {
  to: string;
  purpose: string;
  consentReference: string;
};

export type ExistingIdempotentMutation = {
  requestDigest: string;
  reconciliationRequired: boolean;
};

export function normalizeCallMutationInput(input: Record<string, unknown>): NormalizedCallMutationInput {
  return {
    to: String(input.to ?? '').trim(),
    purpose: String(input.purpose ?? '').trim(),
    consentReference: String(input.consentReference ?? input.consent_reference ?? '').trim()
  };
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== 'object') return value;

  const record = value as Record<string, unknown>;
  return Object.fromEntries(
    Object.keys(record)
      .sort()
      .map((key) => [key, canonicalize(record[key])])
  );
}

export async function digestLogicalMutation(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(canonicalize(value)));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export function classifyIdempotentReplay(input: {
  existing: ExistingIdempotentMutation | null;
  requestDigest: string;
}): 'new' | 'reuse' | 'conflict' | 'reconciliation_required' {
  if (!input.existing) return 'new';
  if (input.existing.requestDigest !== input.requestDigest) return 'conflict';
  if (input.existing.reconciliationRequired) return 'reconciliation_required';
  return 'reuse';
}
