// Canonical ATLAS model resolution. Only explicit server-side settings are accepted.
// Missing profiles remain unconfigured; provider adapters must verify them before use.
function configured(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function resolveConfiguredModels(readEnv, { shared, fast, balanced, deep, legacyShared = null } = {}) {
  if (typeof readEnv !== 'function') throw new TypeError('environment_reader_required');
  const common = configured(readEnv(shared)) || (legacyShared ? configured(readEnv(legacyShared)) : null);
  return {
    fast: configured(readEnv(fast)) || common,
    balanced: configured(readEnv(balanced)) || common,
    deep: configured(readEnv(deep)) || common,
  };
}
