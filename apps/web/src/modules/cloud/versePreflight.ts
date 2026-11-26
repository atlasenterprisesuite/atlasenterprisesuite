/**
 * ATLAS Verse - read-only release preflight on top of ATLAS Manager/Release Control.
 * This contract never launches deployments or claims authenticated production proof.
 */
export type VerseState = 'success' | 'failure' | 'pending' | 'unknown';
export type VerseEnvironment = 'preview' | 'staging' | 'production';
export type VerseProvider = 'cloudflare' | 'vercel' | 'supabase' | 'self-hosted' | 'other';

export type VerseCheck = {
  name: string;
  required: boolean;
  state: VerseState;
};

export type VersePreflightInput = {
  expectedSha: string;
  observedSha: string;
  environment: VerseEnvironment;
  provider: VerseProvider;
  deploymentId: string;
  build: VerseState;
  runtime: VerseState;
  checks: readonly VerseCheck[];
};

export type VersePreflight = {
  status: 'blocked' | 'candidate_only';
  productionVerified: false;
  blockers: string[];
  warnings: string[];
  notice: string;
  evidenceSource: 'operator_input';
};

const SHA_PATTERN = /^[a-f0-9]{40}$/i;
const ALLOWED_STATES = new Set<VerseState>(['success', 'failure', 'pending', 'unknown']);
const CHECK_LIMIT = 50;

export function parseVerseChecks(raw: string): { checks: VerseCheck[]; errors: string[] } {
  const checks: VerseCheck[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();
  const lines = String(raw || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean);

  if (lines.length > CHECK_LIMIT) errors.push(`Máximo ${CHECK_LIMIT} verificaciones por evaluación.`);
  for (const [index, line] of lines.slice(0, CHECK_LIMIT).entries()) {
    const fields = line.split('|').map(field => field.trim());
    if (fields.length !== 3 || !['required', 'optional'].includes(fields[0]) ||
      !fields[1] || fields[1].length > 120 || !ALLOWED_STATES.has(fields[2] as VerseState)) {
      errors.push(`Línea ${index + 1}: formato inválido; usa required|nombre|success.`);
      continue;
    }
    const normalized = fields[1].toLocaleLowerCase();
    if (seen.has(normalized)) {
      errors.push(`Línea ${index + 1}: comprobación duplicada (${fields[1]}).`);
      continue;
    }
    seen.add(normalized);
    checks.push({ name: fields[1], required: fields[0] === 'required', state: fields[2] as VerseState });
  }
  return { checks, errors };
}

export function assessVersePreflight(input: VersePreflightInput): VersePreflight {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const expectedSha = String(input.expectedSha || '').trim();
  const observedSha = String(input.observedSha || '').trim();
  if (!SHA_PATTERN.test(expectedSha)) blockers.push('Falta un SHA de origen exacto de 40 caracteres hexadecimales.');
  if (!SHA_PATTERN.test(observedSha)) blockers.push('Falta un SHA de despliegue observado y válido.');
  if (SHA_PATTERN.test(expectedSha) && SHA_PATTERN.test(observedSha) &&
    expectedSha.toLowerCase() !== observedSha.toLowerCase()) {
    blockers.push('P0: el SHA observado no coincide con el commit de origen.');
  }
  if (!String(input.deploymentId || '').trim()) blockers.push('Falta el identificador del despliegue.');
  if (input.build !== 'success') blockers.push('P0: compilación sin evidencia de éxito.');
  if (input.runtime !== 'success') blockers.push('P0: ejecución sin evidencia de verificación.');

  const required = input.checks.filter(check => check.required);
  if (!required.length) blockers.push('Falta al menos una verificación obligatoria de GitHub/ATLAS.');
  for (const check of input.checks) {
    if (!ALLOWED_STATES.has(check.state)) {
      blockers.push(`Estado inválido: ${check.name}.`);
    } else if (check.required && check.state !== 'success') {
      blockers.push(`P0: verificación obligatoria ${check.name}: ${check.state}.`);
    } else if (!check.required && check.state !== 'success') {
      warnings.push(`Proveedor opcional / P1: ${check.name}: ${check.state}.`);
    }
  }
  // Production authority is defined by the existing ATLAS Manager contract.
  // Optional Vercel previews cannot be silently promoted into Cloudflare production truth.
  if (input.environment === 'production' && input.provider !== 'cloudflare') {
    blockers.push('P0: Cloudflare es el destino canónico de producción de ATLAS; otros proveedores necesitan autorización separada.');
  }

  return {
    status: blockers.length ? 'blocked' : 'candidate_only',
    productionVerified: false,
    blockers,
    warnings,
    notice: input.environment === 'preview'
      ? 'La revisión manual de preview no constituye verificación autenticada ni certifica producción.'
      : 'El preflight manual no constituye verificación autenticada de producción. ATLAS Manager debe verificar permisos, origen, artefactos, runtime y SHA exacto.',
    evidenceSource: 'operator_input'
  };
}
