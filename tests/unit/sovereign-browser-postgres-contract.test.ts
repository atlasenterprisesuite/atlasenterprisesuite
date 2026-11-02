import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
const migration = readFileSync('supabase/migrations/20261102090000_atlas_sovereign_browser_idempotency_777.sql', 'utf8');
describe('ATLAS 777 Sovereign Browser PostgreSQL prerequisite', () => {
  it('keys idempotency by organization, tenant and key', () => {
    expect(migration).toContain('unique (org_id, tenant_id, idempotency_key)');
    expect(migration).toContain('action_digest');
  });
  it('denies public and API roles', () => {
    expect(migration).toContain('enable row level security');
    expect(migration).toContain('force row level security');
    expect(migration).toMatch(/revoke all on public\.execution_browser_idempotency from public, anon, authenticated/);
    expect(migration).not.toMatch(/grant\s+(?:all|insert|update|delete|execute)\b/i);
  });
  it('keeps indeterminate and revoked states terminal by default', () => {
    expect(migration).toContain("'indeterminate'");
    expect(migration).toContain("'revoked'");
    expect(migration).not.toMatch(/on conflict.*do update/is);
  });
});
