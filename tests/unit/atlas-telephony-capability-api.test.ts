import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync('supabase/functions/atlas-communication-telephony/index.ts', 'utf8');
const migration = readFileSync('supabase/migrations/20261004_atlas_call_idempotency.sql', 'utf8');

describe('ATLAS telephony capability API contract', () => {
  it('protects number discovery with the existing read permission and verified provider path', () => {
    expect(source).toContain("operation === 'number-search'");
    expect(source).toContain("requirePermission(req, ctx, 'communication.telephony.read')");
    expect(source).toContain('probeTelnyxVoice(loaded.config)');
    expect(source).toContain('provider_not_ready');
  });

  it('bounds and validates number-search query inputs', () => {
    expect(source).toContain("url.searchParams.get('country_code')");
    expect(source).toContain("url.searchParams.get('area_code')");
    expect(source).toContain("url.searchParams.get('limit')");
    expect(source).toContain('number_search_country_invalid');
    expect(source).toContain('number_search_area_invalid');
    expect(source).toContain('number_search_limit_invalid');
  });

  it('labels provider candidates as discovery-only and never returns secret values', () => {
    expect(source).toContain("ownership: 'discovered_only'");
    expect(source).toContain('searchTelnyxAvailableNumbers');
    expect(source).toContain('provider_secret_values_returned: false');
    expect(source).not.toContain('apiKey: loaded.config.apiKey');
  });

  it('requires a stable idempotency key and persists replay state before provider mutation', () => {
    expect(source).toContain('idempotency_key');
    expect(source).toContain('idempotency_key_required');
    expect(source).toContain('idempotency_key_invalid');
    expect(source).toContain('request_digest');
    expect(source).toContain('classifyIdempotentReplay');
    expect(source).toContain('idempotency_conflict');
    expect(migration).toContain('atlas_call_sessions_org_idempotency_uidx');
    expect(migration).toContain('reconciliation_required');
  });

  it('blocks unverified caller numbers before Telnyx call creation', () => {
    expect(source).toContain(".from('atlas_number_resources')");
    expect(source).toContain(".eq('state', 'active')");
    expect(source).toContain(".eq('upstream_provider', 'telnyx')");
    expect(source).toContain('caller_number_not_verified');
  });

  it('marks transport-ambiguous provider outcomes for reconciliation and never treats them as failed-safe retries', () => {
    expect(source).toContain('provider_outcome_ambiguous');
    expect(source).toContain('reconciliation_required: true');
    expect(source).toContain("reconciliation_reason: 'provider_transport_ambiguous'");
    expect(source).toContain("submission_state: 'ambiguous'");
  });
});
