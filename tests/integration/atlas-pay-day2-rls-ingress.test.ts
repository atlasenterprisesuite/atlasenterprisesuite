import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';

const schema = readFileSync('supabase/migrations/20261012113000_atlas_pay_transaction_event_evidence.sql', 'utf8');
const edge = readFileSync('supabase/functions/atlas-pay-transaction-ingest/index.ts', 'utf8');
const signer = readFileSync('packages/pay/src/secureEventIngress.ts', 'utf8');

describe('ATLAS Financial OS Day 2 RLS and webhook trust contract', () => {
  it('fails closed if Accounts Center migration has not been applied', () => {
    expect(schema).toContain("to_regclass('public.atlas_pay_accounts') is null");
    expect(schema).toContain("to_regclass('public.atlas_pay_balance_evidence') is null");
    expect(schema).toContain('ATLAS Pay Accounts Center prerequisite migration missing');
  });

  it('enforces composite-tenant references and provider-level idempotency', () => {
    expect(schema).toContain('foreign key (org_id, account_id)');
    expect(schema).toContain('foreign key (org_id, provider_connection_id)');
    expect(schema).toContain('unique (org_id, provider_connection_id, provider_event_id)');
    expect(schema).toContain("p_provider_connection_id and org_id = p_org_id");
    expect(schema).toContain("p_account_id and org_id = p_org_id");
  });

  it('protects evidence with RLS and denies writes from browser and service role', () => {
    expect(schema).toContain('enable row level security');
    expect(schema).toContain('force row level security');
    expect(schema).toContain("public.has_identity_permission(org_id, 'pay.read')");
    expect(schema).toContain('revoke all on public.atlas_pay_transaction_events from public, anon, authenticated, service_role');
    expect(schema).toContain("auth.role() is distinct from 'service_role'");
    expect(schema).toContain('atlas_pay_transaction_events_append_only');
    expect(schema).toContain('before update or delete');
  });

  it('uses a transaction for event and audit creation, with retries being safe', () => {
    expect(schema).toContain('on conflict (org_id, provider_connection_id, provider_event_id) do nothing');
    expect(schema).toContain("'transaction_event', v_id, 'verified_event_ingested'");
    expect(schema).toContain("return query select v_old.id, 'duplicate'::text");
    expect(schema).toContain('conflicting provider event identifier');
  });

  it('requires verified provider readiness but does not enable money movement', () => {
    for (const gate of [
      "authorization_state = 'authorized'",
      "regulatory_coverage_state = 'verified'",
      'credentials_verified_at is not null'
    ]) expect(schema).toContain(gate);
    expect(schema).not.toContain('insert into public.atlas_pay_payout_intents');
  });

  it('defaults the server intake to disabled and never trusts organization from a payload', () => {
    expect(edge).toContain("ATLAS_PAY_TRANSACTION_INGEST_ENABLED");
    expect(edge).toContain("!== 'true'");
    expect(edge).toContain('ATLAS_PAY_TRANSACTION_ORG_ID');
    expect(edge).toContain('ATLAS_PAY_TRANSACTION_PROVIDER_CONNECTION_ID');
    expect(edge).toContain("req.headers.get('x-atlas-event-signature')");
    expect(edge).toContain("admin.rpc('atlas_pay_record_transaction_event'");
    expect(edge).not.toContain('req.json()');
    expect(signer).toContain("'org_id' in value");
    expect(signer).toContain('MAX_SKEW_SECONDS = 300');
  });
});
