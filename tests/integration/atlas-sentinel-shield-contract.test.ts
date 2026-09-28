import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

const contract = fs.readFileSync('docs/security/atlas-sentinel.md', 'utf8');

describe('ATLAS Sentinel Shield contract', () => {
  it('uses a dedicated endpoint-security namespace', () => {
    expect(contract).toContain('atlas.security.sentinel-shield');
    expect(contract).toContain('distinct from ATLAS Health Jaque Mate + Sentinel');
    expect(contract).toContain('ATLAS A6 Sentinel');
  });

  it('fails closed on protection and marketing claims', () => {
    expect(contract).toContain('production_verified');
    expect(contract).toContain('comparative marketing claims require reproducible independent validation');
    expect(contract).toContain('unsigned or stale intelligence cannot be promoted to trusted');
  });

  it('preserves reversible remediation and local protection', () => {
    expect(contract).toContain('quarantine is reversible and auditable');
    expect(contract).toContain('cloud unavailability must not silently disable local protection');
  });
});
