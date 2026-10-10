import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

type Manifest = {
  project_ref: string;
  migration_count: number;
  latest_version: string;
  migrations: Array<{ version: string; name: string; file: string }>;
};

const manifest = JSON.parse(
  readFileSync('data/ops/supabase-production-migration-history.json', 'utf8')
) as Manifest;
const active = readdirSync('supabase/migrations').filter((file) => file.endsWith('.sql'));
const versions = new Set(active.map((file) => file.match(/^(\\d+)_/)?.[1]).filter(Boolean));

describe('Supabase production migration history coverage', () => {
  it('keeps every remotely applied migration version represented in Git', () => {
    const missing = manifest.migrations
      .filter((migration) => !versions.has(migration.version))
      .map((migration) => migration.version);
    expect(missing).toEqual([]);
  });

  it('keeps the production migration manifest internally consistent', () => {
    expect(manifest.project_ref).toBe('ggmanzcgtlrvqfoccgsh');
    expect(manifest.migrations).toHaveLength(manifest.migration_count);
    expect(new Set(manifest.migrations.map((migration) => migration.version)).size)
      .toBe(manifest.migration_count);
    expect(manifest.migrations.at(-1)?.version).toBe(manifest.latest_version);
  });
});
