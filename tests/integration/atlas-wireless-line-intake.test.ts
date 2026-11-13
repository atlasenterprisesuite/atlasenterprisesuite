import { readFileSync, existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => existsSync(path) ? readFileSync(path, 'utf8') : '';
const edge = read('supabase/functions/atlas-wireless-line/index.ts');
const migration = read('supabase/migrations/20261113145200_atlas_wireless_line_claims.sql');
const ui = read('apps/web/src/modules/connect/AtlasWirelessLinePage.tsx');
const client = read('apps/web/src/lib/wirelessLineApi.ts');

describe('ATLAS Wireless line registration is safe, private and not service activation', () => {
  it('keeps self-attested claims separate from authoritative carrier numbering', () => {
    expect(migration).toContain('create table if not exists public.atlas_wireless_line_claims');
    expect(migration).toContain("'pending_verification'");
    expect(migration).toContain("'withdrawn'");
    expect(migration).not.toContain("'verified'");
    expect(migration).not.toContain("'active'");
    expect(edge).not.toContain("from('atlas_number_resources')");
    expect(edge).not.toContain('configureVoice');
    expect(edge).not.toContain('activateSubscriber');
  });

  it('protects personal numbers from anonymous and direct browser table access', () => {
    expect(migration).toContain('enable row level security');
    expect(migration).toContain('revoke all on public.atlas_wireless_line_claims from public, anon, authenticated');
    expect(migration).toContain('unique (org_id, e164)');
    expect(edge).toContain("sb.auth.getUser(token)");
    expect(edge).toContain(".from('organization_members')");
    expect(edge).toContain(".eq('status', 'active')");
    expect(edge).toContain("sb.rpc('has_identity_permission'");
    expect(edge).toContain("p: 'wireless.mvno.read'");
    expect(edge).toContain(".eq('org_id', orgId)");
    expect(edge).toContain(".eq('submitted_by', userId)");
    expect(edge).toContain("ownership_asserted:"); // ensures no accidental claim promotion
  });

  it('only returns masked numbers and never leaks raw input to URL or logs', () => {
    expect(edge).toContain('maskUsLineNumber(row.e164)');
    expect(edge).toContain('carrier_verified: false');
    expect(edge).toContain('network_active: false');
    expect(edge).not.toContain('console.log');
    expect(client).toContain("method: 'POST'");
    expect(client).toContain('JSON.stringify({ number, ownership_asserted: ownershipAsserted })');
    expect(client).toContain('authorizedAtlasFetch');
    expect(client).toContain('getActiveAtlasOrganization');
    expect(client).not.toContain('localStorage');
  });

  it('keeps the enrollment UI behind identity guards and disables automatic carrier transfer', () => {
    const routes = read('apps/web/src/modules/connect/ConnectRoutes.tsx');
    const config = read('supabase/config.toml');
    expect(routes).toContain('path="/connect/wireless/line"');
    expect(config).toMatch(/\[functions\.atlas-wireless-line\]\s*verify_jwt\s*=\s*true/);
    expect(ui).toContain('ownershipAsserted');
    expect(ui).toContain('ATLAS activation and number portability remain fail-closed');
    expect(ui).toContain('Carrier verification: pending');
    expect(ui).not.toContain('portIn(');
    expect(ui).not.toContain('deleteEsim');
  });
});
