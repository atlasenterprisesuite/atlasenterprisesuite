import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync('supabase/functions/atlas-infra-status/index.ts', 'utf8');

describe('atlas-infra-status Supabase-first source contract', () => {
  it('reuses the shared provider readiness evaluator', () => {
    expect(source).toContain("from '../_shared/infrastructure-readiness.ts'");
    expect(source).toContain('evaluateInfrastructure');
  });

  it('does not hard-code Vercel as a blocking required stage', () => {
    expect(source).not.toContain("blockers.push({ stage: 'vercel'");
    expect(source).toContain("vercel: { state: vercel.state, required: false }");
  });

  it('marks the Supabase-first production path as required', () => {
    expect(source).toContain("github: { state:");
    expect(source).toContain("supabase: { state:");
    expect(source).toContain("cloudflare: { state:");
    expect(source).toContain("production: { state:");
  });

  it('preserves authenticated infrastructure-admin authorization', () => {
    expect(source).toContain("userClient.auth.getUser()");
    expect(source).toContain("['owner', 'admin', 'platform_admin']");
    expect(source).toContain("infrastructure_admin_required");
  });
});
