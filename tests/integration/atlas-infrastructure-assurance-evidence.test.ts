import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const sourcePath = 'supabase/functions/atlas-infra-evidence/index.ts';
const source = readFileSync(sourcePath, 'utf8');

describe('ATLAS Infrastructure Assurance evidence persistence', () => {
  it('accepts infrastructure-assurance as an explicit verification type', () => {
    expect(source).toContain("'infrastructure-assurance'");
  });

  it('preserves normalized provider, domain, claim, confidence and freshness metadata', () => {
    expect(source).toContain('assurance_domain');
    expect(source).toContain('assurance_claim');
    expect(source).toContain('assurance_status');
    expect(source).toContain('confidence');
    expect(source).toContain('observed_at');
    expect(source).toContain('expires_at');
    expect(source).toContain('stale');
  });

  it('appends canonical assurance evidence into the Master Evidence Registry', () => {
    expect(source).toContain(".from('atlas_master_evidence_registry')");
    expect(source).toContain("module: 'infrastructure-assurance'");
    expect(source).toContain("source_type: 'machine_verification'");
    expect(source).toContain('evidence_level: evidenceLevel');
    expect(source).toContain('supersedes_id: supersedesEvidenceId');
    expect(source).toContain('canonical_evidence');
  });

  it('never mutates an existing Master Evidence Registry row', () => {
    const registrySection = source.slice(source.indexOf(".from('atlas_master_evidence_registry')"));
    expect(registrySection).not.toContain('.update(');
    expect(registrySection).not.toContain('.delete(');
  });

  it('rejects secret-like raw evidence without echoing the submitted value', () => {
    expect(source).toContain('secret_like_evidence_rejected');
    expect(source).toContain('containsSecretLikeMaterial');
    expect(source).toContain('service_role');
    expect(source).toContain('sb_secret_');
    expect(source).toContain('Bearer');
    expect(source).toContain('eyJ');
  });

  it('does not promote stale assurance evidence to a current verified record', () => {
    expect(source).toContain("stale ? 'REQUIERE_REVERIFICACION'");
    expect(source).toContain("stale ? 'unverified'");
  });
});
