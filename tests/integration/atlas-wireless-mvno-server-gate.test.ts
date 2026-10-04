import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => existsSync(path) ? readFileSync(path, 'utf8') : '';

const platformEdgePath = 'supabase/functions/atlas-platform-controls/index.ts';
const legacyEdgePath = 'supabase/functions/atlas-wireless-mvno/index.ts';
const clientPath = 'apps/web/src/lib/wirelessMvnoApi.ts';
const pagePath = 'apps/web/src/modules/connect/AtlasMvnoControlPage.tsx';
const configPath = 'supabase/config.toml';

describe('ATLAS Wireless MVNO shared control plane', () => {
  it('owns authenticated organization-scoped MVNO operations in platform controls only', () => {
    expect(existsSync(platformEdgePath)).toBe(true);
    expect(existsSync(legacyEdgePath)).toBe(false);
    const source = read(platformEdgePath);

    for (const operation of [
      'wireless-mvno-readiness',
      'wireless-mvno-status',
      'wireless-mvno-provision',
      'wireless-mvno-activate',
      'wireless-mvno-suspend',
      'wireless-mvno-reconnect',
      'wireless-mvno-revoke'
    ]) {
      expect(source).toContain(`'${operation}'`);
    }

    expect(source).toContain("req.headers.get('authorization')");
    expect(source).toContain("req.headers.get('x-atlas-org-id')");
    expect(source).toContain(".from('organization_members')");
    expect(source).toContain('provider_not_ready');
    expect(source).toContain('provider_adapter_not_verified');
  });

  it('enforces least-privilege MVNO permissions before blocked provider operations', () => {
    const source = read(platformEdgePath);

    expect(source).toContain("import type { MvnoPermission } from '../_shared/mvno.ts'");
    expect(source).toContain("'wireless-mvno-readiness': 'wireless.mvno.read'");
    expect(source).toContain("'wireless-mvno-status': 'wireless.mvno.read'");
    expect(source).toContain("'wireless-mvno-provision': 'wireless.mvno.provision'");
    expect(source).toContain("'wireless-mvno-activate': 'wireless.mvno.activate'");
    expect(source).toContain("'wireless-mvno-suspend': 'wireless.mvno.suspend'");
    expect(source).toContain("'wireless-mvno-reconnect': 'wireless.mvno.reconnect'");
    expect(source).toContain("'wireless-mvno-revoke': 'wireless.mvno.revoke'");
    expect(source).toContain("has_identity_permission");
    expect(source).not.toContain('requireManageRole');
  });

  it('keeps provider credentials server-side and never claims verified readiness from configuration alone', () => {
    const source = read(platformEdgePath);

    expect(source).toContain('atlas_get_server_secret');
    expect(source).toContain('SECRET');
    expect(source).toContain('provider_verified: false');
    expect(source).toContain('activation_enabled: false');
    expect(source).toContain('provider_secret_values_returned: false');
    expect(source).not.toContain('activationCode');
    expect(source).not.toMatch(/api_token\s*:/i);
  });

  it('uses the JWT-protected platform control plane from the browser surface', () => {
    const config = read(configPath);
    const client = read(clientPath);
    const page = read(pagePath);

    expect(config).toContain('[functions.atlas-platform-controls]');
    expect(config).toMatch(/\[functions\.atlas-platform-controls\][\s\S]*?verify_jwt\s*=\s*true/);
    expect(config).not.toContain('[functions.atlas-wireless-mvno]');
    expect(client).toContain('authorizedAtlasFetch');
    expect(client).toContain('getActiveAtlasOrganization');
    expect(client).toContain('/functions/v1/atlas-platform-controls?api=wireless-mvno-readiness');
    expect(client).not.toContain('/functions/v1/atlas-wireless-mvno');
    expect(page).toContain('getWirelessMvnoReadiness');
    expect(page).toContain("FALLBACK_STATE = 'pending_provider'");
    expect(page).not.toContain('Pilot state: active');
  });
});
