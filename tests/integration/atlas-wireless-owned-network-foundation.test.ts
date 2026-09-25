import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => existsSync(path) ? readFileSync(path, 'utf8') : '';

const contractPath = 'supabase/functions/_shared/atlas-wireless-network.ts';
const permissionPath = 'supabase/migrations/20260925174500_atlas_wireless_owned_network_permissions.sql';
const docsPath = 'docs/atlas-wireless/OWNED_NETWORK_FOUNDATION.md';

describe('ATLAS Wireless owned-network foundation', () => {
  it('defines ATLAS as service provider while separating network mode', () => {
    const source = read(contractPath);
    expect(source).toContain("serviceProvider: 'atlas-wireless'");
    expect(source).toContain("'atlas-owned'");
    expect(source).toContain("'hybrid'");
    expect(source).toContain("'wholesale-fallback'");
  });

  it('requires evidence for core, RAN, spectrum and backhaul readiness', () => {
    const source = read(contractPath);
    for (const layer of ['core', 'ran', 'spectrum', 'backhaul', 'observability']) {
      expect(source).toContain(`'${layer}'`);
    }
    expect(source).toContain('evidence_required:');
    expect(source).toContain('publicServiceReady');
    expect(source).toContain('atlas_wireless_public_service_blocked');
  });

  it('registers infrastructure permissions without granting member control', () => {
    const sql = read(permissionPath);
    for (const permission of [
      'wireless.network.read',
      'wireless.network.core.manage',
      'wireless.network.ran.manage',
      'wireless.network.spectrum.manage',
      'wireless.network.backhaul.manage',
      'wireless.network.audit',
      'wireless.network.admin'
    ]) {
      expect(sql).toContain(`'${permission}'`);
    }
    expect(sql).not.toContain("('member', 'wireless.network.admin')");
    expect(sql).not.toContain("('member', 'wireless.network.ran.manage')");
  });

  it('documents a physical-site definition of done without claiming deployment', () => {
    const docs = read(docsPath);
    expect(docs).toContain('physical RF/network deployment not yet verified');
    expect(docs).toContain('5G Standalone');
    expect(docs).toContain('CBRS');
    expect(docs).toContain('SAS');
    expect(docs).toContain('publicServiceReady');
    expect(docs).toContain('Physical procurement, RF installation, spectrum/SAS onboarding and site commissioning remain external execution steps');
  });
});
