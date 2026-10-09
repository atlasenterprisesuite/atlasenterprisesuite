import { describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inspectMigrationSource } from '../../scripts/inspect-supabase-migration-source.mjs';

function withMigrations(files: Record<string, string>, run: (path: string) => void) {
  const directory = mkdtempSync(join(tmpdir(), 'atlas-migration-source-'));
  try {
    for (const [name, sql] of Object.entries(files)) writeFileSync(join(directory, name), sql);
    run(directory);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

describe('Supabase source-only replay preflight (not live migration proof)', () => {
  it('fails closed when there is no migration baseline', () => {
    withMigrations({}, directory => {
      const report = inspectMigrationSource(directory);
      expect(report.status).toBe('SOURCE_INCOMPLETE');
      expect(report.migrationCount).toBe(0);
      expect(report.notes).toContain('No SQL migrations found');
    });
  });

  it('detects missing identity bootstrap in the first migration', () => {
    withMigrations({
      '20260906034500_google_workspace_integration.sql': [
        'insert into public.identity_permissions (code) values (\'integrations.manage\');',
        'insert into public.identity_role_permissions (role) values (\'owner\');',
        'create table public.atlas_oauth_states (org_id uuid references public.organizations(id));'
      ].join('\n')
    }, directory => {
      const report = inspectMigrationSource(directory);
      expect(report.status).toBe('SOURCE_INCOMPLETE');
      expect(report.missingInitialPrerequisites).toContain('public.identity_permissions');
      expect(report.missingInitialPrerequisites).toContain('public.identity_role_permissions');
      expect(report.missingInitialPrerequisites).toContain('public.organizations');
      expect(report.sourceReplayVerified).toBe(false);
    });
  });

  it('recognizes a preceding explicit bootstrap but never claims full replay verification', () => {
    withMigrations({
      '20260808183211_atlas_core_schema.sql': [
        'create table public.organizations (id uuid primary key);',
        'create table public.identity_permissions (code text primary key);',
        'create table public.identity_role_permissions (role text);'
      ].join('\n'),
      '20260906034500_google_workspace_integration.sql':
        'insert into public.identity_permissions (code) values (\'integrations.manage\');'
    }, directory => {
      const report = inspectMigrationSource(directory);
      expect(report.migrationCount).toBe(2);
      expect(report.missingInitialPrerequisites).toEqual([]);
      expect(report.status).toBe('STATIC_PRECHECK_ONLY');
      expect(report.sourceReplayVerified).toBe(false);
    });
  });

  it('flags nonstandard version lengths without rewriting history', () => {
    withMigrations({ '20260907_accounting_ai_insights.sql': 'select 1;' }, directory => {
      const report = inspectMigrationSource(directory);
      expect(report.nonstandardFileNames).toEqual(['20260907_accounting_ai_insights.sql']);
      expect(report.status).toBe('SOURCE_INCOMPLETE');
    });
  });
});
