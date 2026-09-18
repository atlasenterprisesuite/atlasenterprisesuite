export const SENSITIVE_AI_MODULES = Object.freeze([
  'health',
  'payroll',
  'hr',
  'finance',
  'accounting',
  'lawyer'
]);

export const DEFAULT_AI_DATA_POLICY = Object.freeze({
  audit_logging_enabled: true,
  provider_call_logging_mode: 'disabled',
  selected_modules: Object.freeze([])
});

const STORAGE_MODES = new Set(['disabled', 'per_call', 'all', 'selected_modules']);

function normalizeModule(value) {
  return String(value || 'atlas').trim().toLowerCase();
}

export function isSensitiveAiModule(module) {
  const normalized = normalizeModule(module);
  const tokens = normalized.split(/[^a-z0-9]+/).filter(Boolean);
  return SENSITIVE_AI_MODULES.some((sensitive) =>
    normalized === sensitive ||
    normalized.startsWith(`${sensitive}/`) ||
    normalized.startsWith(`${sensitive}-`) ||
    tokens.includes(sensitive)
  );
}

export function normalizeAiDataPolicy(input = {}) {
  const mode = STORAGE_MODES.has(input?.provider_call_logging_mode)
    ? input.provider_call_logging_mode
    : DEFAULT_AI_DATA_POLICY.provider_call_logging_mode;
  const selected = Array.isArray(input?.selected_modules)
    ? [...new Set(input.selected_modules.map(normalizeModule).filter(Boolean))]
    : [];
  return Object.freeze({
    audit_logging_enabled: true,
    provider_call_logging_mode: mode,
    selected_modules: Object.freeze(selected.filter((module) => !isSensitiveAiModule(module)))
  });
}

export function shouldStoreProviderResponse({ policy, module, perCallStore = null } = {}) {
  const normalized = normalizeAiDataPolicy(policy);
  const normalizedModule = normalizeModule(module);
  if (isSensitiveAiModule(normalizedModule)) return false;

  switch (normalized.provider_call_logging_mode) {
    case 'all':
      return true;
    case 'selected_modules':
      return normalized.selected_modules.includes(normalizedModule);
    case 'per_call':
      return perCallStore === true;
    case 'disabled':
    default:
      return false;
  }
}
