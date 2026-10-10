import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  'supabase/migrations/20261001172715_atlas_pay_control_plane.sql',
  'utf8'
);

describe('ATLAS Pay control-plane migration', () => {
  it('creates organization-scoped provider, instrument, payout and audit records', () => {
    for (const table of [
      'atlas_pay_provider_connections',
      'atlas_pay_instrument_intents',
      'atlas_pay_payout_intents',
      'atlas_pay_audit_events'
    ]) {
      expect(migration).toContain(`public.${table}`);
    }
    expect(migration).toContain("'pay.read'");
    expect(migration).toContain("'pay.manage'");
    expect(migration).toContain("'pay.execute'");
  });

  it('keeps browser mutations fail-closed while allowing RLS-protected reads', () => {
    expect(migration).toContain('enable row level security');
    expect(migration).toContain('public.has_identity_permission');
    expect(migration).toContain('revoke insert, update, delete on public.atlas_pay_provider_connections from authenticated');
    expect(migration).toContain('revoke insert, update, delete on public.atlas_pay_instrument_intents from authenticated');
    expect(migration).toContain('revoke insert, update, delete on public.atlas_pay_payout_intents from authenticated');
    expect(migration).toContain('grant select on public.atlas_pay_provider_connections to authenticated');
    expect(migration).toContain('grant all on public.atlas_pay_provider_connections to service_role');
  });

  it('does not claim to enable regulated rails', () => {
    expect(migration).toContain('does not enable live card issuance');
    expect(migration).toContain('Browser writes stay revoked');
  });
});
