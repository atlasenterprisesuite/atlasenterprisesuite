import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(path, 'utf8');
const schema = read('supabase/migrations/20261113145200_atlas_wireless_line_claims.sql');
const rpc = read('supabase/migrations/20261113162000_atlas_wireless_line_rpc.sql');
const ui = read('apps/web/src/modules/connect/AtlasWirelessLinePage.tsx');
const client = read('apps/web/src/lib/wirelessLineApi.ts');

describe('ATLAS Wireless line intake: private SQL RPC and fail-closed authorization', () => {
  it('keeps self-attested claims separate from carrier-owned number allocations', () => {
    expect(schema).toContain('create table if not exists public.atlas_wireless_line_claims');
    expect(schema).toContain("'pending_verification'");
    expect(schema).not.toContain("'active'");
    expect(schema).toContain('unique (org_id, submitted_by, e164)');
    expect(schema).toContain('enable row level security');
    expect(schema).toContain('revoke all on public.atlas_wireless_line_claims from public, anon, authenticated');
    expect(rpc).not.toContain('atlas_number_resources');
  });

  it('normalizes E.164 safely in the database without the previous backslash bug', () => {
    const patternText = schema.match(/e164 text not null check \(e164 ~ '([^']+)'\)/)?.[1];
    expect(patternText).toBeDefined();
    const pattern = new RegExp(patternText);
    expect(pattern.test('+17865550123')).toBe(true);
    expect(pattern.test('+12025550100')).toBe(true);
    expect(pattern.test('12025550100')).toBe(false);
    expect(pattern.test('+10005550100')).toBe(false);
    expect(rpc).toContain("if p_number is null or length(p_number) > 40");
    expect(rpc).toContain("v_e164 !~ '^[+]1[2-9][0-9]{2}[2-9][0-9]{6}$'");
  });

  it('authorizes each operation from live Auth identity, active organization and permission', () => {
    expect(rpc).toContain('auth.uid()');
    expect(rpc).toContain('status = \'active\'');
    expect(rpc).toContain('user_id = v_user');
    expect(rpc).toContain("public.has_identity_permission(p_org_id, 'wireless.mvno.read')");
    expect(rpc).toContain('where org_id = p_org_id and submitted_by = v_user');
    expect(rpc).toContain('p_ownership_asserted is distinct from true');
    expect(rpc).toContain('on conflict (org_id, submitted_by, e164) do nothing');
    expect(rpc).toContain('wireless.line.claim.submitted');
  });

  it('uses SECURITY INVOKER public wrappers around restricted private definer functions', () => {
    expect(rpc).toContain('create or replace function private.atlas_wireless_line_claim_submit');
    expect(rpc).toContain('create or replace function public.atlas_wireless_line_submit');
    expect(rpc).toMatch(/create or replace function public\.atlas_wireless_line_submit\([\s\S]*?returns jsonb\s*language sql\s*security invoker/);
    expect(rpc).toMatch(/create or replace function public\.atlas_wireless_line_list\([\s\S]*?returns jsonb\s*language sql\s*security invoker/);
    expect(rpc).toContain('revoke all on function public.atlas_wireless_line_submit(uuid,text,boolean) from public, anon');
    expect(rpc).toContain('grant execute on function public.atlas_wireless_line_submit(uuid,text,boolean) to authenticated');
    expect(rpc).toContain('set search_path = pg_catalog, pg_temp');
    expect(rpc).not.toMatch(/grant\s+(?:select|insert|update)\s+on\s+public\.atlas_wireless_line_claims\s+to\s+authenticated/i);
  });

  it('masks every response and exposes only a signed-in ATLAS RPC route', () => {
    expect(rpc).toContain("'masked_number', '•••-•••-' || right(e164,4)");
    expect(rpc).toContain("'network_active', false");
    expect(rpc).toContain("'carrier_verified', false");
    expect(client).toContain('authorizedAtlasFetch');
    expect(client).toContain('getActiveAtlasOrganization');
    expect(client).toContain('/rest/v1/rpc/');
    expect(client).toContain("method: 'POST'");
    expect(client).not.toContain('localStorage');
    expect(ui).toContain('ownershipAsserted');
    expect(ui).toContain('ATLAS activation and number portability remain fail-closed');
  });
});
