/** ATLAS Signal Intelligence — local-only analysis; never identifies a subscriber. */
export type SignalContext = { organizationId: string; actorId: string; permissions: readonly string[]; authorizedOrganizations: readonly string[] };
export type ProviderEvidence = { source: string; reference: string; observedAt: string; authenticated: boolean; authoritative: boolean; lineType?: string; carrier?: string; reportedSpam?: boolean };
export type SignalResult = { normalized: string; declaredName: string | null; identity: 'unverified'; origin: 'prefix_only' | 'unknown'; countryHint: string | null; suspiciousPatterns: string[]; providerStatus: 'not_connected' | 'verified'; providerEvidence: ProviderEvidence | null; risk: 'review' | 'unknown'; audit: { actorId: string; organizationId: string; action: 'signal.analyze' } };
export function analyzeSignal(input: { number: string; message: string; declaredName?: string; organizationId: string; providerEvidence?: ProviderEvidence }, context: SignalContext): SignalResult {
  if (!context.actorId || !context.organizationId || !context.authorizedOrganizations.includes(context.organizationId) || !context.permissions.includes('signal.analyze')) throw new Error('signal_access_denied');
  if (context.organizationId !== input.organizationId) throw new Error('signal_tenant_denied');
  const digits = input.number.replace(/[^0-9]/g, '');
  if (!/^(?:1)?[2-9][0-9]{2}[2-9][0-9]{6}$/.test(digits)) throw new Error('invalid_nanp_number');
  if (!input.message.trim()) throw new Error('message_required');
  if (input.message.length > 5000) throw new Error('message_too_long');
  const normalized = '+1' + (digits.length === 11 ? digits.slice(1) : digits);
  const suspiciousPatterns = [/paths (?:have )?ever crossed|do (?:you|u) remember me|wrong number/i.test(input.message) ? 'ambiguous_introduction' : null, /(?:https?:\/\/|www\.)/i.test(input.message) ? 'contains_link' : null, /(?:gift card|crypto|wire transfer)/i.test(input.message) ? 'payment_language' : null].filter((x): x is string => x !== null);
  const evidence = input.providerEvidence;
  // Provider claims are untrusted until a server-side adapter verifies provenance.
  // Never promote caller-supplied evidence into verified status.
  const verified = false;
  return { normalized, declaredName: input.declaredName?.trim() || null, identity: 'unverified', origin: normalized.startsWith('+1') ? 'prefix_only' : 'unknown', countryHint: 'NANP (country not verified)', suspiciousPatterns, providerStatus: verified ? 'verified' : 'not_connected', providerEvidence: verified ? evidence : null, risk: suspiciousPatterns.length ? 'review' : 'unknown', audit: { actorId: context.actorId, organizationId: context.organizationId, action: 'signal.analyze' } };
}
