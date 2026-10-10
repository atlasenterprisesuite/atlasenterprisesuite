import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

type Manifest = {
  project_ref: string;
  migration_count: number;
  latest_version: string | null;
  migrations: Array<{ version: string; name: string; file: string }>;
  legacy_path_mappings: Array<{ from: string; to: string; reason: string }>;
};

const manifest = JSON.parse(
  readFileSync('data/ops/supabase-production-migration-history.json', 'utf8')
) as Manifest;

const activeFiles = readdirSync('supabase/migrations')
  .filter((file) => file.endsWith('.sql'))
  .sort();

describe('Supabase production migration history contract', () => {
  it('keeps the active directory exactly aligned with production migration history', () => {
    const expected = manifest.migrations.map((migration) => migration.file).sort();
    expect(activeFiles).toEqual(expected);
    expect(activeFiles).toHaveLength(manifest.migration_count);
  });

  it('keeps production migration versions unique and ordered', () => {
    const versions = manifest.migrations.map((migration) => migration.version);
    expect(new Set(versions).size).toBe(versions.length);
    expect([...versions].sort()).toEqual(versions);
    expect(versions.at(-1) ?? null).toBe(manifest.latest_version);
  });

  it('keeps legacy repository paths outside the active migration directory', () => {
    expect(manifest.project_ref).toBe('ggmanzcgtlrvqfoccgsh');
    expect(manifest.legacy_path_mappings).toHaveLength(142);
    for (const mapping of manifest.legacy_path_mappings) {
      expect(mapping.from).toMatch(/^supabase\/migrations\//);
      expect(mapping.to).toMatch(/^supabase\/(migrations|migrations_legacy_pre_remote_sync)\//);
    }
  });
});
