import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync('supabase/functions/atlas-commerce/index.ts', 'utf8');
const config = readFileSync('supabase/config.toml', 'utf8');
const migration = readFileSync(
  'supabase/migrations/20261002132500_commerce_polar_webhook_evidence.sql',
  'utf8'
);

describe('ATLAS Commerce Polar webhook boundary', () => {
  it('uses Polar official version-pinned webhook validation over the raw body', () => {
    expect(source).toContain("npm:@polar-sh/sdk@1.0.1/2026-10");
    expect(source).toContain('polarWebhooks.validateEvent(raw, headers, POLAR_WEBHOOK_SECRET)');
    expect(source).toContain("'webhook-id'");
    expect(source).toContain("'webhook-timestamp'");
    expect(source).toContain("'webhook-signature'");
    expect(source).not.toContain('standardwebhooks');
  });

  it('keeps the gateway public only because atlas-commerce self-authenticates private operations', () => {
    expect(config).toContain('[functions.atlas-commerce]');
    expect(config).toMatch(/\[functions\.atlas-commerce\][\s\S]*?verify_jwt\s*=\s*false/);
    expect(source).toContain('auth.getUser(token)');
    expect(source).toContain("from('organization_members')");
    expect(source).toContain("eq('status', 'active')");
    expect(source).toContain('requirePermission(context');
  });

  it('fails closed when the signing secret or signature is unavailable', () => {
    expect(source).toContain('polar_webhook_not_configured');
    expect(source).toContain('polar_webhook_headers_required');
    expect(source).toContain('polar_webhook_signature_invalid');
    expect(source).toContain('polar_webhook_replay_mismatch');
  });

  it('stores only verified event evidence, not raw provider payloads or automatic entitlement', () => {
    expect(migration).toContain('create table if not exists public.commerce_provider_events');
    expect(migration).toContain('unique (provider, provider_event_id)');
    expect(migration).toContain("processing_state in ('verified_unbound','bound','ignored','processing_failed')");
    expect(migration).toContain('revoke all on public.commerce_provider_events from anon');
    expect(migration).toContain('revoke all on public.commerce_provider_events from authenticated');
    expect(migration).toContain('grant all on public.commerce_provider_events to service_role');
    expect(source).toContain("processing_state: 'verified_unbound'");
    expect(source).toContain('entitlementApplied: false');
    expect(source).not.toContain('raw_payload');
  });
});
