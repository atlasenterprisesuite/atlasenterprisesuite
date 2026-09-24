import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync('supabase/functions/atlas-accounting-insights/index.ts', 'utf8');

describe('ATLAS Accounting Intelligence auth contract', () => {
  it('validates the caller with the explicit bearer JWT', () => {
    expect(source).toContain("const token = bearerToken(req);");
    expect(source).toContain("client.auth.getUser(token)");
    expect(source).not.toContain("client.auth.getUser();");
  });

  it('preserves the caller Authorization header for RLS-scoped queries', () => {
    expect(source).toContain("global: { headers: { Authorization: authorization } }");
    expect(source).toContain(".eq('user_id', user.id)");
    expect(source).toContain(".eq('status', 'active')");
  });

  it('fails closed when the bearer token is missing or invalid', () => {
    expect(source).toContain("error: 'authentication_required'");
    expect(source).toContain("error: 'invalid_session'");
    expect(source).toContain("error: 'organization_access_denied'");
  });
});
