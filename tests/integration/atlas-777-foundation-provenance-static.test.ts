import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Source-only regression guard. This does not certify runtime authorization.
const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('ATLAS 777: authentic PostgreSQL 17 foundation must fail closed', () => {
  it('preserves a negative preflight before loading People', () => {
    const workflow = read('.github/workflows/atlas-777-isolated-postgres.yml');
    expect(workflow).toContain('Negative foundation preflight rejects an incomplete database');
    expect(workflow).toContain('atlas-777-foundation-preflight.sql');
    expect(workflow).toContain('atlas-777-people-real-dependencies.sql');
    expect(workflow).toContain('Explicitly reject premature RPC certification');
    expect(workflow).toContain('ATLAS 777 P0 NO-GO');
  });

  it('requires real native Auth and permission dependencies, not bypasses', () => {
    const gate = read('tests/security/atlas-777-people-real-dependencies.sql');
    for (const dependency of [
      'auth.users', 'auth.uid()', 'public.organizations',
      'public.identity_permissions', 'public.identity_role_permissions',
      'public.audit_row_change()', 'public.has_identity_permission(uuid,text)',
    ]) {
      expect(gate).toContain(dependency);
    }
    expect(gate).toContain('P0_PEOPLE_REAL_MIGRATION_DEPENDENCIES_MISSING');
  });

  it('flags historical DEFINER vs current INVOKER as an unresolved provenance difference', () => {
    const historical = read('tests/security/recovered/20260809032705_atlas_identity_foundation.sql');
    const start = historical.indexOf('create or replace function public.has_identity_permission(');
    expect(start).toBeGreaterThanOrEqual(0);
    const definition = historical.slice(start, historical.indexOf('$$;', start));
    expect(definition).toMatch(/security\s+definer/i);
    const provenance = read('docs/security/atlas-777-pg17-bootstrap-provenance-20261102.md');
    expect(provenance).toMatch(/SECURITY INVOKER/);
    expect(provenance).toMatch(/historical migration text is \*\*not\*\* equivalent/);
  });
});
