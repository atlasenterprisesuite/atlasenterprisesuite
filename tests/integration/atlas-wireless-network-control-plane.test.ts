import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => existsSync(path) ? readFileSync(path, 'utf8') : '';

const migrationPath = 'supabase/migrations/20260925182000_atlas_wireless_network_control_plane.sql';
const platformEdgePath = 'supabase/functions/atlas-platform-controls/index.ts';
const sharedControlPath = 'supabase/functions/_shared/wireless-platform-control.ts';
const legacyEdgePath = 'supabase/functions/atlas-wireless-network/index.ts';
const configPath = 'supabase/config.toml';
const routesPath = 'apps/web/src/modules/connect/ConnectRoutes.tsx';
const pagePath = 'apps/web/src/modules/connect/AtlasWirelessNetworkPage.tsx';
const clientPath = 'apps/web/src/lib/wirelessNetworkApi.ts';
const verifyContractPath = 'data/ops/global-production-verification.json';
const authorizedVerifierPath = 'supabase/functions/atlas-cloudflare-production-http-verify/index.ts';

describe('ATLAS Wireless network shared control plane', () => {
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

  it('exposes authenticated read operations through platform controls only', () => {
    const edge = read(platformEdgePath);
    const source = read(sharedControlPath);
    const config = read(configPath);

    expect(existsSync(platformEdgePath)).toBe(true);
    expect(existsSync(sharedControlPath)).toBe(true);
    expect(existsSync(legacyEdgePath)).toBe(false);
    expect(config).toContain('[functions.atlas-platform-controls]');
    expect(config).toMatch(/\[functions\.atlas-platform-controls\][\s\S]*?verify_jwt\s*=\s*true/);
    expect(config).not.toContain('[functions.atlas-wireless-network]');
    expect(edge).toContain("from '../_shared/wireless-platform-control.ts'");
    expect(source).toContain("req.headers.get('authorization')");
    expect(source).toContain("req.headers.get('x-atlas-org-id')");
    expect(source).toContain("'wireless-network-readiness'");
    expect(source).toContain("'wireless-network-inventory'");
    expect(source).toContain("'wireless.network.read'");
    expect(source).toContain('network_profile_not_configured');
    expect(source).toContain('technical_public_ready');
  });

  it('routes the authenticated web surface through platform controls and never defaults to ready', () => {
    const routes = read(routesPath);
    const page = read(pagePath);
    const client = read(clientPath);

    expect(routes).toContain('path="/connect/wireless/network"');
    expect(page).toContain('ATLAS-Owned Network');
    expect(page).toContain('Authenticated network inventory is unavailable. All owned-network readiness remains fail-closed.');
    expect(page).not.toContain('lab_ready: true');
    expect(page).not.toContain('technical_public_ready: true');
    expect(client).toContain('authorizedAtlasFetch');
    expect(client).toContain('getActiveAtlasOrganization');
    expect(client).toContain('/functions/v1/atlas-platform-controls?api=wireless-network-');
    expect(client).not.toContain('/functions/v1/atlas-wireless-network');
  });

  it('includes the owned-network route in canonical production verification', () => {
    const contract = JSON.parse(read(verifyContractPath)) as { public_routes: string[] };
    const verifier = read(authorizedVerifierPath);

    expect(contract.public_routes).toContain('/connect/wireless/network');
    expect(verifier).toContain("'/connect/wireless/network'");
  });
});
