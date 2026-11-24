import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildCapabilityManifest, serializeCapabilityManifest } from '../../scripts/generate-atlas-capability-manifest';

const artifactUrl = new URL('../../docs/generated/atlas-agent-capabilities.json', import.meta.url);

function collectKeys(value: unknown, keys = new Set<string>()): Set<string> {
  if (!value || typeof value !== 'object') return keys;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    keys.add(key);
    if (Array.isArray(child)) child.forEach((item) => collectKeys(item, keys));
    else collectKeys(child, keys);
  }
  return keys;
}

describe('ATLAS capability manifest', () => {
  it('is deterministic and sorted by capability id', () => {
    const manifest = buildCapabilityManifest();
    const ids = manifest.capabilities.map((capability) => capability.id);
    expect(ids).toEqual([...ids].sort());
    expect(manifest.schema_version).toBe(1);
    expect(manifest.generated_from).toBe('packages/execution/src/capability-registry.ts');
    expect(serializeCapabilityManifest()).toBe(`${JSON.stringify(manifest, null, 2)}\n`);
  });

  it('contains no secret-bearing field names or runtime truth', () => {
    const keys = [...collectKeys(buildCapabilityManifest())];
    expect(keys.some((key) => /api.?key|secret|token|credential_value/i.test(key))).toBe(false);
    expect(keys).not.toContain('verified');
    expect(keys).not.toContain('connected');
  });

  it('matches the committed generated artifact exactly', () => {
    const committed = readFileSync(fileURLToPath(artifactUrl), 'utf8');
    expect(committed).toBe(serializeCapabilityManifest());
  });
});
