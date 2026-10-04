import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => existsSync(path) ? readFileSync(path, 'utf8') : '';

const migrationPath = 'supabase/migrations/20260925182000_atlas_wireless_network_control_plane.sql';
const edgePath = 'supabase/functions/atlas-wireless-network/index.ts';
const configPath = 'supabase/config.toml';
const routesPath = 'apps/web/src/modules/connect/ConnectRoutes.tsx';
const pagePath = 'apps/web/src/modules/connect/AtlasWirelessNetworkPage.tsx';
const clientPath = 'apps/web/src/lib/wirelessNetworkApi.ts';
const verifyContractPath = 'data/ops/global-production-verification.json';
const authorizedVerifierPath = 'supabase/functions/atlas-cloudflare-production-http-verify/index.ts';

describe('ATLAS Wireless network control plane', () => {
  it('creates tenant-scoped read-only persistence with RLS', () => {
    const sql = read(migrationPath);
    for (const table of [
      'wireless_network_profiles',
      'wireless_network_components',
      'wireless_ran_sites',
      'wireless_spectrum_authorizations',
      'wireless_backhaul_links'
    ]) {
      expect(sql).toContain(`create table if not exists public.${table}`);
    }
    expect(sql.match(/enable row level security/g)?.length).toBe(5);
    expect(sql).toContain('organization_members');
    expect(sql).toContain('auth.uid()');
    expect(sql).toContain('revoke insert, update, delete');
    expect(sql).toContain('grant select');
  });

  it('exposes only authenticated read operations and permission checks', () => {
    const edge = read(edgePath);
    const config = read(configPath);

    expect(config).toContain('[functions.atlas-wireless-network]');
    expect(config).toMatch(/\[functions\.atlas-wireless-network\][\s\S]*?verify_jwt\s*=\s*true/);
    expect(edge).toContain("req.headers.get('authorization')");
    expect(edge).toContain("req.headers.get('x-atlas-org-id')");
    expect(edge).toContain("p: 'wireless.network.read'");
    expect(edge).toContain("['readiness', 'inventory']");
    expect(edge).toContain("req.method !== 'GET'");
    expect(edge).not.toContain("method: 'POST'");
    expect(edge).toContain('network_profile_not_configured');
    expect(edge).toContain('technical_public_ready');
  });

  it('routes the authenticated web surface and never defaults to ready', () => {
    const routes = read(routesPath);
    const page = read(pagePath);
    const client = read(clientPath);

    expect(routes).toContain('path="/connect/wireless/network"');
    expect(page).toContain('ATLAS-Owned Network');
    expect(page).toContain('Authenticated network inventory is unavailable. All owned-network readiness remains fail-closed.');
    expect(page).not.toContain("lab_ready: true");
    expect(page).not.toContain("technical_public_ready: true");
    expect(client).toContain('authorizedAtlasFetch');
    expect(client).toContain('getActiveAtlasOrganization');
    expect(client).toContain('/functions/v1/atlas-wireless-network?api=');
  });

  it('includes the owned-network route in canonical production verification', () => {
    const contract = JSON.parse(read(verifyContractPath)) as { public_routes: string[] };
    const verifier = read(authorizedVerifierPath);

    expect(contract.public_routes).toContain('/connect/wireless/network');
    expect(verifier).toContain("'/connect/wireless/network'");
  });
});
