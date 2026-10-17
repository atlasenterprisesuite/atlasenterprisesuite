/** Preliminary text-only screening: flags are risk indicators, never proof of fraud or legitimacy. */
export type RecruiterRiskCode =
  | 'upfront_payment' | 'sensitive_information' | 'check_scheme'
  | 'off_platform' | 'urgency' | 'personal_email' | 'domain_mismatch';

export type RecruiterRiskFlag = {
  code: RecruiterRiskCode;
  severity: 'high' | 'caution';
  title: string;
  explanation: string;
};

export type RecruiterRiskResult = {
  level: 'high-risk' | 'review' | 'inconclusive';
  verified: false;
  flags: RecruiterRiskFlag[];
};

export type RecruiterRiskInput = {
  message: string;
  senderEmail?: string;
  /** Provided by the user, NOT fetched or validated against an employer registry. */
  officialEmployerWebsite?: string;
};

function emailDomain(email: string): string | null {
  const match = /^[^@\s]+@([a-z\d.-]+\.[a-z]{2,})$/i.exec(email.trim());
  return match ? match[1].toLowerCase() : null;
}

function websiteDomain(website: string): string | null {
  const candidate = website.trim();
  if (!candidate || /\s/.test(candidate)) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(candidate) ? candidate : `https://${candidate}`);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
    const domain = url.hostname.toLowerCase().replace(/^www\./, '').replace(/\.$/, '');
    return /^[a-z\d-]+(?:\.[a-z\d-]+)+$/.test(domain) ? domain : null;
  } catch {
    return null;
  }
}

export function screenRecruiterMessage(input: RecruiterRiskInput): RecruiterRiskResult {
  const message = input.message.slice(0, 4000);
  const flags: RecruiterRiskFlag[] = [];
  const add = (code: RecruiterRiskCode, severity: 'high' | 'caution', title: string, explanation: string) => {
    flags.push({ code, severity, title, explanation });
  };

  if (/\b(?:pay|send|transfer|deposit|purchase|buy)\b.{0,100}\b(?:fee|gift cards?|bitcoin|cryptocurrency|crypto|equipment|training kit|background check|processing charge)\b/i.test(message) || /\b(?:paga(?:r)?|abona(?:r)?|deposita(?:r)?|transfiere|env[ií]a(?:r)?|compra(?:r)?)\b.{0,100}\b(?:cuota|tarifa|comisi[oó]n|anticipo|equipo|materiales|curso|capacitaci[oó]n|tarjetas? de regalo|criptomonedas?|bitcoin)\b/i.test(message)) {
    add('upfront_payment', 'high', 'Payment or purchase requested',
      'Do not pay to secure a job or purchase equipment from instructions in an unverified offer.');
  }

  if (/\b(?:send|share|provide|upload|enter|give)\b.{0,120}\b(?:ssn|social security (?:number)?|bank account|routing number|passport|driver\x27s licen[cs]e|password|login credentials)\b/i.test(message) || /\b(?:env[ií]a|comparte|facilita|proporciona|sube|entrega|ingresa)\b.{0,120}\b(?:n[uú]mero de seguro social|seguro social|cuenta bancaria|n[uú]mero de cuenta|contrase[nñ]a|pasaporte|credenciales|licencia de conducir)\b/i.test(message)) {
    add('sensitive_information', 'high', 'Sensitive information requested',
      'Confirm the hiring process through an independent official contact before supplying identity, banking or login details.');
  }

  if (/\b(?:deposit|cash)\b.{0,80}\b(?:check|cheque)\b|\b(?:check|cheque)\b.{0,80}\b(?:equipment|refund|transfer|send back)\b/i.test(message) || /\b(?:deposita(?:r)?|cobra(?:r)?)\b.{0,80}\b(?:cheque|tal[oó]n)\b|\bcheque\b.{0,80}\b(?:equipo|reembolso|transferencia)\b/i.test(message)) {
    add('check_scheme', 'high', 'Potential fake-check pattern',
      'Never deposit an employer check to buy supplies or forward funds before an independently verified hiring process.');
  }

  if (/\b(?:contact|message|text|continue|switch|move|reach(?:\s+me)?)\b.{0,80}\b(?:whatsapp|telegram|signal)\b/i.test(message) || /\b(?:escr[ií]be(?:me)?|cont[aá]ctame|contacta|contin[uú]a|hablemos|pasa(?:mos)?|env[ií]a)\b.{0,80}\b(?:whatsapp|telegram|signal)\b/i.test(message)) {
    add('off_platform', 'caution', 'Move to private messaging requested',
      'Ask to continue through a verifiable company email or official recruiting portal.');
  }

  if (/\b(?:urgent|immediately|act now|limited time|only today|within 24 hours|within 48 hours)\b/i.test(message) || /\b(?:urgente|inmediatamente|ahora mismo|solo hoy|hoy mismo|en las pr[oó]ximas 24 horas|oferta por tiempo limitado)\b/i.test(message)) {
    add('urgency', 'caution', 'Pressure or urgency language',
      'Take time to verify the organization and job posting independently.');
  }

  const sender = emailDomain(input.senderEmail || '');
  const employer = websiteDomain(input.officialEmployerWebsite || '');
  if (sender && /^(?:gmail|yahoo|outlook|hotmail|icloud|aol|protonmail|proton)\.(?:com|me)$/.test(sender)) {
    add('personal_email', 'caution', 'Personal email provider',
      'A personal address is not proof of fraud; independently confirm the sender is authorized.');
  }
  if (sender && employer && sender !== employer && !sender.endsWith(`.${employer}`)) {
    add('domain_mismatch', 'caution', 'Sender and supplied employer domains differ',
      'Recruiting agencies may use separate domains. Confirm the relationship using the employer website you found independently.');
  }

  return {
    level: flags.some((flag) => flag.severity === 'high') ? 'high-risk'
      : flags.length ? 'review' : 'inconclusive',
    verified: false,
    flags
  };
}
