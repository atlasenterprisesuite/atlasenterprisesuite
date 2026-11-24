import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync('supabase/functions/atlas-mobile/index.ts', 'utf8');

describe('ATLAS mobile gateway evidence boundary', () => {
  it('fails closed for runtime and provider-sensitive feature state', () => {
    expect(source).toContain("state: 'unverified'");
    expect(source).toContain("state: 'unsupported_runtime'");
    expect(source).toContain('last_verified_at');
    expect(source).not.toMatch(/state:\s*['"]active['"][^\n]*without/i);
  });

  it('allows only metadata-safe audit event kinds', () => {
    expect(source).toContain("api === 'audit'");
    expect(source).toContain('ALLOWED_AUDIT_EVENTS');
    expect(source).toContain("error: 'audit_event_not_allowed'");
    expect(source).toContain('actor_user_id: ctx.userId');
    expect(source).toContain('organization_id: ctx.orgId');
  });

  it('drops secret-like audit metadata keys instead of persisting arbitrary bodies', () => {
    expect(source).toContain('sanitizeAuditMetadata');
    for (const key of ['authorization', 'token', 'password', 'cookie', 'api_key', 'secret', 'message_content']) {
      expect(source).toContain(`'${key}'`);
    }
    expect(source).not.toContain('metadata: body.metadata');
  });

  it('does not treat the service role as caller identity', () => {
    expect(source).toContain("Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')");
    expect(source).toContain('/auth/v1/user');
    expect(source).not.toContain('authorization:`Bearer ${SERVICE_ROLE_KEY}`');
  });
});
