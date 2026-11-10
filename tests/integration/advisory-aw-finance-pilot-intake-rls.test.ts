import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Static regression gate; authenticated cross-firm E2E remains mandatory before promotion.
const migrationPath = 'supabase/migrations/20261009234500_advisory_launch_intakes_firm_scope_rls.sql';
const migration = readFileSync(resolve(process.cwd(), migrationPath), 'utf8');

describe('AW Finance pilot #001: launch intake confidentiality', () => {
  it('replaces the legacy organization-only read policy', () => {
    expect(migration).toContain('drop policy if exists advisory_launch_intakes_read');
    expect(migration).toMatch(/create policy advisory_launch_intakes_read\s+on public\.advisory_launch_intakes\s+for select\s+to authenticated/i);
  });

  it('requires BOTH Advisory read permission and active membership of the matching firm', () => {
    expect(migration).toContain("public.has_identity_permission(org_id, 'advisory.read')");
    expect(migration).toContain('atlas_private.is_advisory_firm_member(org_id, firm_id)');
    expect(migration).toMatch(/using\s*\(\s*public\.has_identity_permission\(org_id, 'advisory\.read'\)\s+and\s+atlas_private\.is_advisory_firm_member\(org_id, firm_id\)\s*\)/i);
  });

  it('does not make sensitive lead information available to anonymous browsers', () => {
    expect(migration).toContain('revoke all on public.advisory_launch_intakes from anon');
    expect(migration).not.toMatch(/grant\s+(?:select|all)\s+on\s+public\.advisory_launch_intakes\s+to\s+anon/i);
  });
});
