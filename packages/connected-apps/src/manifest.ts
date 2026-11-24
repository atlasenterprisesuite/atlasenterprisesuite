import type { ProviderCapabilityManifest, ProviderManifest } from './types';

function requiredText(value: string, error: string): void {
  if (!value.trim()) throw new Error(error);
}

function validateCapability(capability: ProviderCapabilityManifest): void {
  requiredText(capability.code, 'capability_code_required');
  const scopes = capability.providerScopes.map((scope) => scope.trim()).filter(Boolean);
  if (scopes.length !== capability.providerScopes.length) throw new Error('provider_scope_required');
  if (new Set(scopes).size !== scopes.length) throw new Error('duplicate_provider_scope');
}

export function validateProviderManifest(manifest: ProviderManifest): ProviderManifest {
  requiredText(manifest.providerId, 'provider_id_required');
  requiredText(manifest.displayName, 'provider_display_name_required');
  if (manifest.authKinds.length === 0) throw new Error('auth_kind_required');
  if (!Number.isInteger(manifest.adapterVersion) || manifest.adapterVersion < 1) {
    throw new Error('invalid_adapter_version');
  }

  const capabilityCodes = new Set<string>();
  for (const capability of manifest.capabilities) {
    validateCapability(capability);
    if (capabilityCodes.has(capability.code)) throw new Error('duplicate_capability');
    capabilityCodes.add(capability.code);
  }
  return manifest;
}

export function requiredScopesForCapability(
  manifest: ProviderManifest,
  capabilityCode: string
): readonly string[] {
  const capability = manifest.capabilities.find((item) => item.code === capabilityCode);
  if (!capability) throw new Error('capability_not_supported');
  return [...capability.providerScopes];
}
