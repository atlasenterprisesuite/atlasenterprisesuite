/**
 * Self-attested phone line intake is NOT carrier allocation or number ownership proof.
 * Never promote a claim into atlas_number_resources without authenticated upstream evidence.
 */
export type AtlasWirelessLineClaimStatus = 'pending_verification' | 'withdrawn';

export function normalizeUsLineNumber(input: unknown): string {
  if (typeof input !== 'string' || input.length > 40) {
    throw new Error('invalid_phone_number');
  }
  const compact = input.trim().replace(/[\s().-]/g, '');
  const normalized = /^\d{10}$/.test(compact)
    ? `+1${compact}`
    : /^1\d{10}$/.test(compact)
      ? `+${compact}`
      : compact;
  // NANP area-code and exchange prefixes cannot start with 0 or 1.
  if (!/^\+1[2-9]\d{2}[2-9]\d{6}$/.test(normalized)) {
    throw new Error('invalid_phone_number');
  }
  return normalized;
}

export function maskUsLineNumber(value: string): string {
  return `•••-•••-${value.slice(-4)}`;
}
