import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const edge = readFileSync('supabase/functions/atlas-platform-controls/index.ts', 'utf8');
const config = readFileSync('supabase/config.toml', 'utf8');
const migration = readFileSync('supabase/migrations/20261002190313_atlas_urban_twin_governed_intake.sql', 'utf8');
const api = readFileSync('apps/web/src/modules/city/urbanTwinIntakeApi.ts', 'utf8');
const panel = readFileSync('apps/web/src/modules/city/UrbanTwinIntakePanel.tsx', 'utf8');
const repository = readFileSync('apps/web/src/modules/city/urbanTwinRepository.ts', 'utf8');

describe('ATLAS Urban Twin governed intake', () => {
  it('keeps the Edge Function authenticated and organization scoped', () => {
    expect(config).toContain('[functions.atlas-platform-controls]');
    expect(config).toContain('verify_jwt = true');
    expect(edge).toContain('auth.getUser(token)');
    expect(edge).toContain("(api || '').startsWith('urban-twin-')");
    expect(edge).toContain("req.headers.get('x-atlas-org-id')");
    expect(edge).toContain(".from('organization_members')");
    expect(edge).toContain(".eq('status', 'active')");
  });

  it('requires manage permission for registration and separate verify permission for promotion', () => {
    expect(migration).toContain("city.twin.verify");
    expect(migration).toContain("('owner', 'city.twin.verify')");
    expect(migration).toContain("('admin', 'city.twin.verify')");
    expect(migration).not.toContain("('manager', 'city.twin.verify')");
    expect(edge).toContain("urbanTwinPermission(ctx, 'city.twin.manage')");
    expect(edge).toContain("urbanTwinPermission(ctx, 'city.twin.verify')");
  });

  it('creates all user-entered entities and bindings as unverified', () => {
    expect(edge).toContain("source_kind: 'manual'");
    expect(edge).toContain("verification_state: 'unverified'");
    expect(edge).toContain("verification_evidence_required");
    expect(edge).toContain("verification_method: 'manual_evidence_review'");
  });

  it('rejects obvious secret material from evidence references', () => {
    expect(edge).toContain('authorization:|bearer');
    expect(edge).toContain('service[_-]?role');
    expect(panel).toContain('Do not paste passwords, bearer tokens, API keys or service-role secrets.');
  });

  it('uses the control plane for writes while the repository remains read-only', () => {
    expect(api).toContain('/functions/v1/atlas-platform-controls?api=');
    expect(api).toContain('urban-twin-${api}');
    expect(api).toContain('registerUrbanTwinEntity');
    expect(api).toContain('verifyUrbanTwinTarget');
    expect(repository).not.toContain("method: 'POST'");
  });

  it('states the truth boundary directly in the physical intake UI', () => {
    expect(panel).toContain('Register first. Verify separately.');
    expect(panel).toContain('Registration never marks an asset live.');
    expect(panel).toContain('does not imply active telemetry');
  });
});
