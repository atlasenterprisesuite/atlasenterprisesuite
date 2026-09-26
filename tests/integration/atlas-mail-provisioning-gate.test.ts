import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const routes = readFileSync('apps/web/src/modules/connect/ConnectRoutes.tsx', 'utf8');
const home = readFileSync('apps/web/src/modules/connect/ConnectHomePage.tsx', 'utf8');
const page = readFileSync('apps/web/src/modules/connect/AtlasMailProvisioningPage.tsx', 'utf8');
const edge = readFileSync('supabase/functions/atlas-mail-provisioning/index.ts', 'utf8');
const config = readFileSync('supabase/config.toml', 'utf8');

describe('ATLAS Mail provisioning gate', () => {
  it('exposes the governed mail route from ATLAS Connect', () => {
    expect(routes).toContain('path="/connect/mail"');
    expect(home).toContain('to="/connect/mail"');
  });

  it('keeps provisioning disabled until authenticated provider evidence is verified', () => {
    expect(page).toContain("readiness?.provider_verified === true");
    expect(page).toContain('disabled={!canProvision || busy}');
    expect(edge).toContain("p: 'integrations.manage'");
    expect(edge).toContain("throw new MailError('provider_not_verified'");
    expect(edge).toContain('secret_values_returned: false');
  });

  it('registers the edge function and constrains aliases to the configured ATLAS domain', () => {
    expect(config).toContain('[functions.atlas-mail-provisioning]');
    expect(edge).toContain('validLocalPart');
    expect(edge).toContain('`${localPart}@${cfg.domain}`');
    expect(edge).toContain('connect.mail.aliases.provisioned');
  });
});
