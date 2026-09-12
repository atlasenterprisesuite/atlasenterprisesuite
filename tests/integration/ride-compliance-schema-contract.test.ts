import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const sql = readFileSync(resolve(process.cwd(), 'supabase/migrations/20260912_ride_profile_photo_compliance.sql'), 'utf8');

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
});
