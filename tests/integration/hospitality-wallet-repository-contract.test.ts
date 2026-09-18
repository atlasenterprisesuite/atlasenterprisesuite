import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const sharedPath = resolve(process.cwd(), 'supabase/functions/_shared/hospitality/repository.ts');
const accessPath = resolve(process.cwd(), 'supabase/functions/atlas-hospitality-access/_shared/repository.ts');

describe('Hospitality Wallet repository contract', () => {
  it('scopes every property repository query to organization and property', () => {
    expect(existsSync(sharedPath)).toBe(true);
    const source = readFileSync(sharedPath, 'utf8');

    expect(source).toContain(".eq('org_id', orgId)");
    expect(source).toContain(".eq('property_id', propertyId)");
    for (const name of [
      'loadPmsProviderInstance', 'listStays', 'loadStay', 'listRoomAssignments',
      'loadActiveRoomAssignment', 'loadAutomationPolicy', 'listWalletCredentials',
      'findActiveWalletCredential'
    ]) expect(source).toContain(`function ${name}`);
  });

  it('uses one conflict-safe write and loads the canonical duplicate event', () => {
    expect(existsSync(sharedPath)).toBe(true);
    const source = readFileSync(sharedPath, 'utf8');

    expect(source).toContain("onConflict: 'org_id,property_id,pms_provider_instance_id,idempotency_key'");
    expect(source).toContain('ignoreDuplicates: true');
    expect(source).toContain('inserted: false');
    expect(source).toContain(".eq('pms_provider_instance_id', row.pms_provider_instance_id)");
    expect(source).toContain(".eq('idempotency_key', row.idempotency_key)");
  });

  it('persists provisioning state and writes allowlisted service audit metadata', () => {
    expect(existsSync(sharedPath)).toBe(true);
    const source = readFileSync(sharedPath, 'utf8');

    expect(source).toContain('function insertWalletProvisioningSession');
    expect(source).toContain('function updateWalletProvisioningSession');
    expect(source).toContain('user_id: null');
    expect(source).toContain("actor_type: 'service'");
    expect(source).toContain('SAFE_AUDIT_PAYLOAD_KEYS');
    expect(source).not.toMatch(/select\([^)]*(provider_token|private_key|key_bytes|decrypted_provision_token)/i);
  });

  it('re-exports shared Wallet helpers without removing access-provider persistence', () => {
    const source = readFileSync(accessPath, 'utf8');

    expect(source).toContain("../../../_shared/hospitality/repository.ts");
    expect(source).toContain('listPmsProviderInstances');
    expect(source).toContain('writeHospitalityServiceAudit');
    expect(source).toContain('function listProviderInstances');
    expect(source).toContain('function loadRoomMapping');
  });
});
