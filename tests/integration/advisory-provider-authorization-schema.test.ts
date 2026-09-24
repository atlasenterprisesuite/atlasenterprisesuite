import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const sql = readFileSync(
  'supabase/migrations/20260921134500_advisory_provider_authorizations.sql',
  'utf8'
);

describe('Advisory provider authorization persistence', () => {
  it('creates a firm-scoped authorization record with RLS', () => {
    expect(sql).toContain('public.advisory_provider_authorizations');
    expect(sql).toMatch(/unique \(firm_id, capability\)/i);
    expect(sql).toMatch(/alter table public\.advisory_provider_authorizations enable row level security/i);
    expect(sql).toContain('is_advisory_firm_member');
  });

  it('keeps organizational approval separate from provider connection truth', () => {
    expect(sql).toContain('Authorization does not imply provider connectivity or verification');
    expect(sql).not.toContain('provider_verified boolean');
    expect(sql).not.toContain("state text not null default 'connected'");
  });

  it('records audit evidence and exposes a governed authenticated RPC', () => {
    expect(sql).toContain("'provider_authorization'");
    expect(sql).toContain('advisory_provider_authorization_audit');
    expect(sql).toContain('advisory_set_provider_authorization');
    expect(sql).toContain('Advisory manage permission required');
    expect(sql).toContain('Advisory firm membership required');
  });
});
