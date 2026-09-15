import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(path, 'utf8');

const webSource = [
  'apps/web/src/lib/integrationsApi.ts',
  'apps/web/src/modules/settings/connected-apps/ConnectedAppsRoutes.tsx',
  'apps/web/src/modules/settings/connected-apps/ConnectedAppsPage.tsx',
  'apps/web/src/modules/settings/connected-apps/ProviderDetailPage.tsx'
].map(read).join('\n');

const foundationMigration = read('supabase/migrations/20260915161500_connected_apps_microsoft_foundation.sql');
const oauthSource = read('supabase/functions/atlas-integration-oauth/index.ts');
const gatewaySource = read('supabase/functions/atlas-integrations/index.ts');
const auditSource = read('supabase/functions/_shared/integrations/audit.ts');
const assistantBridge = read('supabase/functions/atlas-copilot/integration-capability.mjs');

describe('Connected Apps secret boundary regression', () => {
  it('never persists Microsoft provider credentials in browser storage or browser DTO source', () => {
    expect(webSource).not.toMatch(/localStorage[\s\S]{0,120}(access_token|refresh_token|client_secret|code_verifier)/i);
    expect(webSource).not.toMatch(/\b(access_token|refresh_token|client_secret|code_verifier)\b/i);
  });

  it('keeps provider credential plaintext out of the integration schema', () => {
    expect(foundationMigration).not.toMatch(/\baccess_token\s+(text|varchar|jsonb)/i);
    expect(foundationMigration).not.toMatch(/\brefresh_token\s+(text|varchar|jsonb)/i);
    expect(foundationMigration).not.toMatch(/\bclient_secret\s+(text|varchar|jsonb)/i);
    expect(foundationMigration).not.toMatch(/\bcode_verifier\s+(text|varchar|jsonb)/i);
    expect(foundationMigration).toContain('credential_ref');
  });

  it('cannot place provider code, state, verifier, or token material in the internal callback redirect', () => {
    expect(oauthSource).toContain("target.searchParams.set('oauth', status)");
    expect(oauthSource).not.toMatch(/target\.searchParams\.set\(['"](?:code|state|access_token|refresh_token|client_secret|code_verifier)['"]/i);
  });

  it('writes metadata-only audit records and rejects sensitive audit keys', () => {
    expect(auditSource).toContain('assertAuditMetadataSafe');
    expect(auditSource).toMatch(/token\|secret\|password\|authorization\|cookie/i);
    expect(auditSource).not.toMatch(/metadata:\s*input\.(accessToken|refreshToken|clientSecret)/);
  });

  it('does not serialize decrypted credentials in Integration Gateway responses', () => {
    expect(gatewaySource).not.toMatch(/json\(req,\s*\{[^}]*\b(accessToken|refreshToken|clientSecret)\b/s);
    expect(gatewaySource).toContain('safeConnection');
    expect(gatewaySource).toContain('safeGrant');
    expect(gatewaySource).toContain('safeEvent');
  });

  it('rejects secret-shaped data before an integration result reaches ATLAS Assistant', () => {
    expect(assistantBridge).toContain('integration_secret_boundary_violation');
    expect(assistantBridge).toContain('containsSecretKey');
    expect(assistantBridge).toContain("new Set(['microsoft.profile.read'])");
  });
});
