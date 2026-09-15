import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const sql = readFileSync(resolve(root, 'supabase/migrations/20260912_ride_profile_photo_compliance.sql'), 'utf8');
const atomicMigrationPath = resolve(root, 'supabase/migrations/20260912_ride_profile_photo_atomicity.sql');
const repositorySource = readFileSync(resolve(root, 'supabase/functions/atlas-ride-compliance/_shared/repository.ts'), 'utf8');
const edgeSource = readFileSync(resolve(root, 'supabase/functions/atlas-ride-compliance/index.ts'), 'utf8');

describe('ATLAS Ride compliance schema contract', () => {
  it('creates scoped compliance records and a private evidence bucket', () => {
    expect(sql).toContain('create table if not exists public.compliance_requirements');
    expect(sql).toContain('create table if not exists public.compliance_submissions');
    expect(sql).toContain('create table if not exists public.compliance_audit_events');
    expect(sql).toContain("'atlas-compliance-evidence'");
    expect(sql).toMatch(/public\s*:\s*false|false\s*,\s*'atlas-compliance-evidence'/i);
  });

  it('enforces RLS and authenticated organization membership', () => {
    expect(sql.match(/enable row level security/g)?.length).toBeGreaterThanOrEqual(3);
    expect(sql).toContain('organization_members');
    expect(sql).toContain('auth.uid()');
    expect(sql).toContain("status = 'active'");
  });

  it('does not create public evidence access', () => {
    expect(sql).not.toMatch(/public\s*:\s*true/i);
    expect(sql).not.toMatch(/create policy[^;]+storage\.objects[^;]+to public/is);
  });

  it('finalizes submission state and submitted audit atomically', () => {
    expect(existsSync(atomicMigrationPath)).toBe(true);
    const atomicSql = readFileSync(atomicMigrationPath, 'utf8');
    expect(atomicSql).toContain('atlas_ride_compliance_finalize_submission');
    expect(atomicSql).toContain("'submission.submitted'");
    expect(atomicSql).toContain('insert into public.compliance_audit_events');
    expect(atomicSql.match(/for update/gi)?.length).toBeGreaterThanOrEqual(4);
    expect(repositorySource).toContain(".rpc('atlas_ride_compliance_finalize_submission'");
    expect(edgeSource).not.toContain("eventType: 'submission.submitted'");
  });

  it('transitions review state and review audit atomically', () => {
    expect(existsSync(atomicMigrationPath)).toBe(true);
    const atomicSql = readFileSync(atomicMigrationPath, 'utf8');
    expect(atomicSql).toContain('atlas_ride_compliance_review_transition');
    expect(atomicSql).toContain("p_target_status in ('under_review','approved','rejected')");
    expect(atomicSql).toContain("om.role in ('owner','admin','platform_admin')");
    expect(atomicSql).toContain("'review.started'");
    expect(atomicSql).toContain("'review.approved'");
    expect(atomicSql).toContain("'review.rejected'");
    expect(atomicSql).toMatch(/revoke execute on function[\s\S]+from public/i);
    expect(atomicSql).toMatch(/grant execute on function[\s\S]+to service_role/i);
    expect(repositorySource).toContain(".rpc('atlas_ride_compliance_review_transition'");
    expect(edgeSource).not.toMatch(/eventType: 'review\.(started|approved|rejected)'/);
  });
});
