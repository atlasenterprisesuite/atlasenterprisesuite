/** Pure, first-party field proposal engine. Never writes to DOM or submits a form. */
export type AutofillCategory = 'name' | 'email' | 'phone' | 'company' | 'address';
export type AutofillField = { id: string; label: string; type?: string; autocomplete?: string; disabled?: boolean; readOnly?: boolean; hidden?: boolean };
export type AutofillProfile = Partial<Record<AutofillCategory, string>>;
export type AutofillProposal = { fieldId: string; category: AutofillCategory; value: string; source: 'authorized-profile' };
const aliases: Record<AutofillCategory, string[]> = {
  name: ['name', 'full name', 'nombre completo', 'nombre y apellido'],
  email: ['email', 'e-mail', 'correo', 'correo electrónico', 'email address'],
  phone: ['phone', 'telephone', 'teléfono', 'telefono', 'mobile number'],
  company: ['company', 'company name', 'empresa', 'organización'],
  address: ['street address', 'address line 1', 'dirección', 'direccion', 'domicilio']
};
const allowedAutocomplete: Partial<Record<string, AutofillCategory>> = {
  name: 'name', email: 'email', tel: 'phone', organization: 'company', 'street-address': 'address', 'address-line1': 'address'
};
const sensitive = /password|passcode|pin|otp|one.time|ssn|social.security|tax.id|itin|ein|passport|license|credit.card|card.number|cvv|cvc|routing|account.number|iban|bank|birth|dob|salud|health|contrase|clave|tarjeta|cuenta bancaria|firma|signature/i;
function normalize(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase().replace(/\s+/g, ' ');
}
export function proposeAutofill(fields: readonly AutofillField[], profile: Readonly<AutofillProfile>): AutofillProposal[] {
  const proposals: AutofillProposal[] = [];
  const used = new Set<string>();
  for (const field of fields) {
    if (!field.id || used.has(field.id) || field.disabled || field.readOnly || field.hidden || field.type === 'hidden') continue;
    used.add(field.id);
    const label = normalize(field.label || '');
    const hint = normalize(field.autocomplete || '');
    if (sensitive.test([label, hint, field.id, field.type || ''].join(' ')) || /^(cc-|bday|one-time-code|transaction-|new-password|current-password)/.test(hint)) continue;
    const fromHint = allowedAutocomplete[hint];
    const candidates = (Object.keys(aliases) as AutofillCategory[]).filter(category => aliases[category].some(alias => normalize(alias) === label));
    const category = fromHint || (candidates.length === 1 ? candidates[0] : undefined);
    if (!category || (fromHint && candidates.length && !candidates.includes(fromHint))) continue;
    const value = profile[category];
    if (typeof value !== 'string' || !value.trim()) continue;
    if (field.type === 'email' && category !== 'email') continue;
    if (field.type === 'tel' && category !== 'phone') continue;
    if (field.type && !['text', 'email', 'tel', 'search'].includes(field.type)) continue;
    proposals.push({ fieldId: field.id, category, value: value.trim(), source: 'authorized-profile' });
  }
  return proposals;
}
