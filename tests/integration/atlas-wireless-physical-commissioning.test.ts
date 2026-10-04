import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => existsSync(path) ? readFileSync(path, 'utf8') : '';

const migrationPath = 'supabase/migrations/20260926104500_atlas_wireless_physical_commissioning.sql';
const edgePath = 'supabase/functions/atlas-wireless-commissioning/index.ts';
const configPath = 'supabase/config.toml';
const routePath = 'apps/web/src/modules/connect/ConnectRoutes.tsx';
const pagePath = 'apps/web/src/modules/connect/AtlasWirelessCommissioningPage.tsx';
const clientPath = 'apps/web/src/lib/wirelessCommissioningApi.ts';

describe('ATLAS Wireless physical commissioning', () => {
  it('persists organization-scoped commissioning evidence with read-only browser RLS', () => {
    const sql = read(migrationPath);

    expect(sql).toContain('create table if not exists public.wireless_commissioning_runs');
    expect(sql).toContain('create table if not exists public.wireless_commissioning_tasks');
    expect(sql.match(/enable row level security/g)?.length).toBe(2);
    expect(sql).toContain('organization_members');
    expect(sql).toContain('auth.uid()');
    expect(sql).toContain('revoke insert, update, delete');
    expect(sql).toContain('grant select');
    expect(sql).toContain("state <> 'commissioned'");
    expect(sql).toContain("state not in ('passed','not_applicable')");
  });

  it('registers separate read/write/approve permissions without member grants', () => {
    const sql = read(migrationPath);
    for (const permission of [
      'wireless.network.commissioning.read',
      'wireless.network.commissioning.write',
      'wireless.network.commissioning.approve'
    ]) {
      expect(sql).toContain(`'${permission}'`);
    }
    expect(sql).not.toContain("('member', 'wireless.network.commissioning.write')");
    expect(sql).not.toContain("('member', 'wireless.network.commissioning.approve')");
  });

  it('requires all physical tasks and evidence before approval', () => {
    const edge = read(edgePath);
    for (const task of [
      'physical_site',
      'radio_commissioned',
      'spectrum_authorized',
      'sas_coordinated',
      'core_reachable',
      'backhaul_operational',
      'subscriber_identity_ready',
      'device_attach',
      'data_path',
      'observability',
      'emergency_boundary',
      'rf_safety'
    ]) {
      expect(edge).toContain(`'${task}'`);
    }
    expect(edge).toContain('commissioning_not_ready_for_approval');
    expect(edge).toContain('task_not_passed:');
    expect(edge).toContain('task_evidence_invalid:');
    expect(edge).toContain('approval_evidence_required');
    expect(edge).toContain("state: 'commissioned'");
    expect(edge).toContain("state !== 'ready_for_approval'");
    expect(edge).toContain('commissioned_run_immutable');
  });

  it('enforces JWT, tenant scope, permission checks and audit records', () => {
    const edge = read(edgePath);
    const config = read(configPath);

    expect(config).toMatch(/\[functions\.atlas-wireless-commissioning\][\s\S]*?verify_jwt\s*=\s*true/);
    expect(edge).toContain("req.headers.get('x-atlas-org-id')");
    expect(edge).toContain("req.headers.get('authorization')");
    expect(edge).toContain("p: permission");
    expect(edge).toContain("wireless.network.commissioning.approve");
    expect(edge).toContain("admin.from('audit_logs').insert");
    expect(edge).toContain(".eq('org_id', ctx.orgId)");
  });

  it('routes a fail-closed user surface without claiming physical readiness', () => {
    const route = read(routePath);
    const page = read(pagePath);
    const client = read(clientPath);

    expect(route).toContain('path="/connect/wireless/commissioning"');
    expect(page).toContain('Physical Commissioning');
    expect(page).toContain('No run becomes commissioned from configuration, purchase orders or UI state alone.');
    expect(page).toContain('12 commissioning gates');
    expect(page).toContain('Not yet commissioned.');
    expect(client).toContain('authorizedAtlasFetch');
    expect(client).toContain('/functions/v1/atlas-wireless-commissioning?api=');
  });
});
