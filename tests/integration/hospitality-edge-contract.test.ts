import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const edgePath = resolve(root, 'supabase/functions/atlas-hospitality-access/index.ts');
const repositoryPath = resolve(root, 'supabase/functions/atlas-hospitality-access/_shared/repository.ts');
const sharedFiles = [
  '_shared/context.ts',
  '_shared/repository.ts',
  '_shared/errors.ts',
  '_shared/provider-registry.ts'
].map((path) => resolve(root, 'supabase/functions/atlas-hospitality-access', path));

describe('ATLAS Hospitality Edge Function contract', () => {
  it('removes the legacy global single-provider configuration', () => {
    const source = readFileSync(edgePath, 'utf8');
    expect(source).not.toContain('ATLAS_HOSPITALITY_PROVIDER_ID');
    expect(source).not.toContain('ATLAS_HOSPITALITY_PROVIDER_ENDPOINT');
    expect(source).not.toContain('ATLAS_HOSPITALITY_PROVIDER_TOKEN');
  });

  it('splits context, repository, error, and provider registry responsibilities', () => {
    for (const file of sharedFiles) expect(existsSync(file)).toBe(true);
    const source = readFileSync(edgePath, 'utf8');
    expect(source).toContain("./_shared/context.ts");
    expect(source).toContain("./_shared/repository.ts");
    expect(source).toContain("./_shared/errors.ts");
    expect(source).toContain("./_shared/provider-registry.ts");
  });

  it('keeps the supported API operations explicit', () => {
    const source = readFileSync(edgePath, 'utf8');
    for (const operation of [
      'readiness',
      'providers',
      'rooms',
      'credentials',
      'issue',
      'revoke',
      'credential-status',
      'audit'
    ]) {
      expect(source).toContain(`'${operation}'`);
    }
  });

  it('uses verified room mapping and explicit provider capabilities for issuance', () => {
    const source = readFileSync(edgePath, 'utf8');
    expect(source).toContain('loadRoomMapping');
    expect(source).toContain('provider_room_id');
    expect(source).toContain("'credential.issue'");
    expect(source).toContain('insertCredentialReference');
    expect(source).not.toContain('credential_lifecycle_orchestration_pending');
  });

  it('implements revocation against the stored provider credential reference', () => {
    const source = readFileSync(edgePath, 'utf8');
    expect(source).toContain('loadCredentialReference');
    expect(source).toContain("'credential.revoke'");
    expect(source).toContain('updateCredentialReferenceStatus');
    expect(source).toContain('provider_credential_id');
    expect(source).not.toContain('unavailableMutation');
  });

  it('keeps all persistence helpers organization/property scoped', () => {
    const source = readFileSync(repositoryPath, 'utf8');
    expect(source).toContain(".eq('org_id', orgId)");
    expect(source).toContain(".eq('property_id', propertyId)");
  });

  it('does not return raw credential or provider secret material', () => {
    const source = readFileSync(edgePath, 'utf8').toLowerCase();
    expect(source).not.toMatch(/response\.json\([^)]*(master_key|private_key|provider_token|key_bytes|rfid_dump|encoder_secret)/);
  });
});
