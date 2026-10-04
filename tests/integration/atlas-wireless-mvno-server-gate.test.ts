import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => existsSync(path) ? readFileSync(path, 'utf8') : '';

const edgePath = 'supabase/functions/atlas-wireless-mvno/index.ts';
const clientPath = 'apps/web/src/lib/wirelessMvnoApi.ts';
const pagePath = 'apps/web/src/modules/connect/AtlasMvnoControlPage.tsx';
const configPath = 'supabase/config.toml';

describe('ATLAS Wireless MVNO server gate', () => {
  it('exposes authenticated organization-scoped readiness and lifecycle operations', () => {
    expect(existsSync(edgePath)).toBe(true);
    const source = read(edgePath);

    for (const operation of ['readiness', 'status', 'provision', 'activate', 'suspend', 'reconnect', 'revoke']) {
      expect(source).toContain(`'${operation}'`);
    }

    expect(source).toContain("req.headers.get('authorization')");
    expect(source).toContain("req.headers.get('x-atlas-org-id')");
    expect(source).toContain(".from('organization_members')");
    expect(source).toContain("provider_not_ready");
    expect(source).toContain("provider_adapter_not_verified");
  });

  it('enforces least-privilege MVNO permissions before blocked provider operations', () => {
    const source = read(edgePath);

    expect(source).toContain("import type { MvnoPermission } from '../_shared/mvno.ts'");
    expect(source).toContain("readiness: 'wireless.mvno.read'");
    expect(source).toContain("status: 'wireless.mvno.read'");
    expect(source).toContain("provision: 'wireless.mvno.provision'");
    expect(source).toContain("activate: 'wireless.mvno.activate'");
    expect(source).toContain("suspend: 'wireless.mvno.suspend'");
    expect(source).toContain("reconnect: 'wireless.mvno.reconnect'");
    expect(source).toContain("revoke: 'wireless.mvno.revoke'");
    expect(source).toContain("sb.rpc('has_identity_permission'");
    expect(source).not.toContain('requireManageRole');
  });

  it('keeps provider credentials server-side and never claims verified readiness from configuration alone', () => {
    const source = read(edgePath);

    expect(source).toContain("atlas_get_server_secret");
    expect(source).toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(source).toContain("provider_verified: false");
    expect(source).toContain("activation_enabled: false");
    expect(source).toContain("provider_secret_values_returned: false");
    expect(source).not.toContain("activationCode");
    expect(source).not.toMatch(/api_token\s*:/i);
  });

  it('requires JWT verification and uses server readiness in the browser surface', () => {
    const config = read(configPath);
    const client = read(clientPath);
    const page = read(pagePath);

    expect(config).toContain('[functions.atlas-wireless-mvno]');
    expect(config).toMatch(/\[functions\.atlas-wireless-mvno\][\s\S]*?verify_jwt\s*=\s*true/);
    expect(client).toContain("authorizedAtlasFetch");
    expect(client).toContain("getActiveAtlasOrganization");
    expect(client).toContain("/functions/v1/atlas-wireless-mvno?api=readiness");
    expect(page).toContain("getWirelessMvnoReadiness");
    expect(page).toContain("FALLBACK_STATE = 'pending_provider'");
    expect(page).not.toContain("Pilot state: active");
  });
});
