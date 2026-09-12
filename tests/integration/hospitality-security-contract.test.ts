import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const browserRoots = [
  resolve(root, 'apps/web/src/modules/hospitality'),
  resolve(root, 'apps/web/src/lib/hospitalityApi.ts')
];

const forbiddenIdentifiers = [
  'master_key',
  'private_key',
  'provider_token',
  'key_bytes',
  'rfid_dump',
  'encoder_secret'
];

function sourceFiles(path: string): string[] {
  if (!statSync(path).isDirectory()) return [path];
  return readdirSync(path).flatMap((name) => {
    const child = resolve(path, name);
    return statSync(child).isDirectory() ? sourceFiles(child) : /\.(ts|tsx)$/.test(name) ? [child] : [];
  });
}

describe('ATLAS Hospitality security contract', () => {
  it('keeps provider credential material out of browser Hospitality source', () => {
    const source = browserRoots.flatMap(sourceFiles).map((file) => readFileSync(file, 'utf8').toLowerCase()).join('\n');
    for (const identifier of forbiddenIdentifiers) expect(source).not.toContain(identifier);
  });

  it('does not expose provider runtime configuration through Edge Function JSON responses', () => {
    const source = readFileSync(resolve(root, 'supabase/functions/atlas-hospitality-access/index.ts'), 'utf8').toLowerCase();
    for (const identifier of forbiddenIdentifiers) {
      const responseLeak = new RegExp(`json\\([^;]*(?:${identifier})`, 'i');
      expect(source).not.toMatch(responseLeak);
    }
    expect(source).not.toContain('atlas_hospitality_provider_config_json');
  });

  it('stores runtime provider configuration only in the server-side registry boundary', () => {
    const registry = readFileSync(resolve(root, 'supabase/functions/atlas-hospitality-access/_shared/provider-registry.ts'), 'utf8');
    expect(registry).toContain('ATLAS_HOSPITALITY_PROVIDER_CONFIG_JSON');
    expect(registry).toContain('Deno');
  });

  it('keeps direct remote door opening outside the implemented API surface', () => {
    const edge = readFileSync(resolve(root, 'supabase/functions/atlas-hospitality-access/index.ts'), 'utf8').toLowerCase();
    expect(edge).not.toContain('door.remote_open');
    expect(edge).not.toContain('remote-open');
    expect(edge).not.toContain('unlock-door');
  });
});
