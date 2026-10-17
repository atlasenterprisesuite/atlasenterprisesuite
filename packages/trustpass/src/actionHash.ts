import type { TrustActionInput } from './types';

type JsonSafe = null | boolean | number | string | JsonSafe[] | { [key: string]: JsonSafe };

function normalize(value: unknown): JsonSafe {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('unsupported_trust_action_value');
    return Object.is(value, -0) ? 0 : value;
  }
  if (Array.isArray(value)) return value.map((item) => normalize(item));
  if (typeof value === 'object') {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new Error('unsupported_trust_action_value');
    }

    const output: Record<string, JsonSafe> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      const entry = (value as Record<string, unknown>)[key];
      if (entry === undefined) throw new Error('unsupported_trust_action_value');
      output[key] = normalize(entry);
    }
    return output;
  }
  throw new Error('unsupported_trust_action_value');
}

export function canonicalizeTrustAction(input: TrustActionInput): string {
  if (!input.actionType || !input.tenantId) throw new Error('invalid_trust_action');
  return JSON.stringify(normalize(input));
}

export async function hashTrustAction(input: TrustActionInput): Promise<string> {
  const canonical = canonicalizeTrustAction(input);
  const bytes = new TextEncoder().encode(canonical);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
