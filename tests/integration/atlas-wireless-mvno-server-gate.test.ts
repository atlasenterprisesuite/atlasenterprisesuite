import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => existsSync(path) ? readFileSync(path, 'utf8') : '';

const edgePath = 'supabase/functions/atlas-platform-controls/index.ts';
const retiredStandalonePath = 'supabase/functions/atlas-wireless-mvno/index.ts';
const clientPath = 'apps/web/src/lib/wirelessMvnoApi.ts';
const pagePath = 'apps/web/src/modules/connect/AtlasMvnoControlPage.tsx';
const configPath = 'supabase/config.toml';

describe('ATLAS Wireless MVNO server gate', () => {
  it('reuses the canonical authenticated platform-controls function instead of consuming a new Edge Function slot', () => {
    expect(existsSync(edgePath)).toBe(true);
    expect(existsSync(retiredStandalonePath)).toBe(false);

    const source = read(edgePath);
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
    expect(source).toContain("'provider_not_ready'");
    expect(source).toContain("'provider_adapter_not_verified'");
  });

  it('preserves the pre-existing platform-control domains while adding Wireless', () => {
    const source = read(edgePath);
    for (const legacyApi of [
      'integration-upsert',
      'agent-create',
      'agent-transition',
      'voice-create',
      'voice-recording-confirm',
      'voice-delete',
      'transcript-create'
    ]) {
      expect(source).toContain(`'${legacyApi}'`);
    }
    expect(source).toContain("domains: ['integrations','agents','voice','wireless']");
  });

  it('keeps provider credentials server-side and never treats configuration as verification', () => {
    const source = read(edgePath);

    expect(source).toContain("atlas_get_server_secret");
    expect(source).toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(source).toContain("provider_verified: false");
    expect(source).toContain("activation_enabled: false");
    expect(source).toContain("provider_secret_values_returned: false");
    expect(source).not.toContain("activationCode");
  });

  it('requires JWT verification and uses the deployed platform-controls surface from the browser', () => {
    const config = read(configPath);
    const client = read(clientPath);
    const page = read(pagePath);

    expect(config).toContain('[functions.atlas-platform-controls]');
    expect(config).toMatch(/\[functions\.atlas-platform-controls\][\s\S]*?verify_jwt\s*=\s*true/);
    expect(config).not.toContain('[functions.atlas-wireless-mvno]');
    expect(client).toContain("authorizedAtlasFetch");
    expect(client).toContain("getActiveAtlasOrganization");
    expect(client).toContain("/functions/v1/atlas-platform-controls?api=wireless-mvno-readiness");
    expect(page).toContain("getWirelessMvnoReadiness");
    expect(page).toContain("FALLBACK_STATE = 'pending_provider'");
    expect(page).not.toContain("Pilot state: active");
  });
});
