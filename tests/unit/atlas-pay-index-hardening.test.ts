import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const hardening = readFileSync(
  'supabase/migrations/20261001172914_atlas_pay_fk_index_hardening.sql',
  'utf8'
);

describe('ATLAS Pay FK index hardening', () => {
  it('covers every advisor-reported ATLAS Pay foreign key', () => {
    expect(hardening).toContain('atlas_pay_audit_events_org_created_idx');
    expect(hardening).toContain('on public.atlas_pay_audit_events (org_id, created_at desc)');

    expect(hardening).toContain('atlas_pay_instrument_intents_provider_connection_idx');
    expect(hardening).toContain('on public.atlas_pay_instrument_intents (provider_connection_id)');

    expect(hardening).toContain('atlas_pay_payout_intents_provider_connection_idx');
    expect(hardening).toContain('on public.atlas_pay_payout_intents (provider_connection_id)');
  });

  it('keeps provider FK indexes sparse when the adapter is not yet attached', () => {
    expect(hardening.match(/where provider_connection_id is not null;/g)).toHaveLength(2);
  });
});
