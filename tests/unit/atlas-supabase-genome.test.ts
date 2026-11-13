import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const manifest = JSON.parse(readFileSync('docs/atlas-supabase/genome-live-20261113.json', 'utf8'));
const exporter = readFileSync('scripts/export-atlas-supabase-genome.ps1', 'utf8');

describe('ATLAS Supabase Genome — immutable evidence and fail-closed export', () => {
  it('has one distinct, verifiable bundle fingerprint for every deployed function', () => {
    expect(manifest.kind).toBe('READ_ONLY_METADATA_FINGERPRINT_NOT_BACKUP');
    expect(manifest.edge_function_count).toBe(100);
    expect(manifest.edge_functions).toHaveLength(100);
    const slugs = manifest.edge_functions.map((item: { slug: string }) => item.slug);
    expect(new Set(slugs).size).toBe(100);
    for (const item of manifest.edge_functions) {
      expect(item.bundle_sha256).toMatch(/^[a-f0-9]{64}$/);
      expect(item.deployed_version).toBeGreaterThan(0);
    }
  });

  it('records source drift without claiming missing code has been backed up', () => {
    const absent = manifest.edge_functions.filter((item: { source_dir_in_git_main: boolean }) => !item.source_dir_in_git_main);
    expect(absent).toHaveLength(66);
    expect(manifest.deployed_edge_functions_without_source_dir_in_git_main).toBe(66);
    expect(manifest.applied_migrations_count).toBe(321);
    expect(manifest.git_main_migration_sql_files).toBe(142);
    expect(manifest.applied_migration_versions_present_in_git_main).toBe(19);
    expect(manifest.applied_migration_versions_absent_from_git_main).toBe(302);
  });

  it('exports locally with encryption and refuses partial copies', () => {
    expect(exporter).toContain('supabase functions download');
    expect(exporter).toContain('supabase db dump');
    expect(exporter).toContain('age -r $AgeRecipient');
    expect(exporter).toContain('SHA256SUMS.json');
    expect(exporter).toContain('throw "Function download failed: $slug"');
    expect(exporter).toContain('if ($LASTEXITCODE -ne 0) { throw');
    expect(exporter).not.toMatch(/supabase\s+(?:projects\s+delete|db\s+reset|functions\s+deploy|db\s+push)/);
  });
});
